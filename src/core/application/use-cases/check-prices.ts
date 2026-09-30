import { PriceUnavailableError } from "@/core/domain/errors";
import { CHECK_FAILURES_TO_REPORT, groupFailuresByStore } from "@/core/domain/failures";
import { evaluateAlertOptions, type PriceOption } from "@/core/domain/alert-policy";
import { includedVariants, type ProductVariant } from "@/core/domain/variants";
import type { Product } from "@/core/domain/product";
import type { PriceReading } from "@/core/domain/price";
import type { PriceInsight } from "@/core/domain/price-insight";
import type { Clock } from "../ports/clock";
import type { Deal, Notifier } from "../ports/notifier";
import type { PriceReader } from "../ports/price-reader";
import type { FailureRepository } from "../ports/failure-repository";
import type { ProductRepository } from "../ports/product-repository";
import type { WatchRepository } from "../ports/watch-repository";
import { refreshPriceInsight } from "./price-insight";

export interface CheckPricesDeps {
  products: ProductRepository;
  failures: FailureRepository;
  /** Quien administra la app recibe el resumen de fallos nuevos (si está configurado). */
  adminEmail?: string | null;
  watches: WatchRepository;
  priceReader: PriceReader;
  notifier: Notifier;
  clock: Clock;
  /** Pausa entre consultas a una misma tienda, para no sobrecargarla. */
  delayBetweenRequestsMs?: number;
  log?: (message: string) => void;
}

export interface CheckPricesResult {
  checked: number;
  failed: { url: string; error: string }[];
  emailsSent: number;
  deals: number;
}

/**
 * Revisa el precio de todos los productos seguidos, guarda el historial
 * y envía un email por usuario con las ofertas nuevas.
 */
export async function checkPrices(deps: CheckPricesDeps): Promise<CheckPricesResult> {
  const { products, watches, notifier, clock } = deps;
  const log = deps.log ?? (() => {});
  const result: CheckPricesResult = { checked: 0, failed: [], emailsSent: 0, deals: 0 };
  const dealsByEmail = new Map<string, Deal[]>();

  const byStore = groupByHost(await products.listWatched());
  // Las tiendas se consultan en paralelo; los productos de una misma tienda, de a uno.
  await Promise.all(
    [...byStore.values()].map(async (storeProducts) => {
      for (const [index, product] of storeProducts.entries()) {
        if (index > 0 && deps.delayBetweenRequestsMs) await sleep(deps.delayBetweenRequestsMs);
        const read = await readProduct(deps, product, result, log);
        if (!read) continue;
        const { reading, insight } = read;

        for (const { watch, email, emailNotifications } of await watches.listRecipients(product.id)) {
          // Sin avisos por email no se marca nada como avisado: si los reactiva,
          // recibe las ofertas que sigan vigentes en la próxima revisión.
          if (!emailNotifications) continue;
          const decision = evaluateAlertOptions(watch, priceOptions(reading, watch.excludedVariants));
          if (decision.nextLastNotifiedPrice !== watch.lastNotifiedPrice) {
            await watches.updateLastNotified(
              watch.id,
              decision.nextLastNotifiedPrice,
              decision.notify ? clock.now() : watch.lastNotifiedAt,
            );
          }
          if (!decision.notify) continue;
          const best = decision.matching.reduce((a, b) => (b.price < a.price ? b : a));
          const list = dealsByEmail.get(email) ?? [];
          list.push({
            productId: product.id,
            name: reading.name,
            store: product.store,
            url: product.url,
            imageUrl: reading.imageUrl,
            currency: reading.currency,
            price: best.price,
            listPrice: best.listPrice,
            targetPrice: watch.targetPrice,
            reasons: decision.reasons,
            variants: reading.variants?.length ? decision.matching.map((o) => (o as ProductVariant).name) : [],
            insight: reading.variants?.length ? null : insight,
          });
          dealsByEmail.set(email, list);
        }
      }
    }),
  );

  for (const [email, deals] of dealsByEmail) {
    try {
      await notifier.sendDeals(email, deals);
      result.emailsSent++;
      result.deals += deals.length;
      log(`Aviso enviado a ${email} (${deals.length} ofertas)`);
    } catch (error) {
      log(`No se pudo enviar el aviso a ${email}: ${errorMessage(error)}`);
    }
  }
  await sendFailureReport(deps, log);
  return result;
}

/** Envía a quien administra los fallos que todavía no le había informado. */
async function sendFailureReport(deps: CheckPricesDeps, log: (message: string) => void) {
  if (!deps.adminEmail) return;
  const pending = await deps.failures.listUnnotified();
  if (pending.length === 0) return;
  try {
    await deps.notifier.sendFailureReport(deps.adminEmail, groupFailuresByStore(pending));
    await deps.failures.markNotified(
      pending.map((f) => f.id),
      deps.clock.now(),
    );
    log(`Resumen de ${pending.length === 1 ? "1 fallo" : `${pending.length} fallos`} enviado a ${deps.adminEmail}`);
  } catch (error) {
    log(`No se pudo enviar el resumen de fallos: ${errorMessage(error)}`);
  }
}

async function readProduct(
  deps: CheckPricesDeps,
  product: Product,
  result: CheckPricesResult,
  log: (message: string) => void,
): Promise<{ reading: PriceReading; insight: PriceInsight | null } | null> {
  const checkedAt = deps.clock.now();
  try {
    const reading = await deps.priceReader.read(product.url);
    await deps.products.recordReading(product.id, reading, checkedAt);
    const insight = await refreshPriceInsight(deps.products, product.id, checkedAt);
    result.checked++;
    log(`${product.store} · ${reading.name}: ${reading.price}${reading.listPrice ? ` (antes ${reading.listPrice})` : ""}`);
    return { reading, insight };
  } catch (error) {
    const message = errorMessage(error);
    const failuresInARow = await deps.products.recordError(product.id, message, checkedAt);
    // Se reporta una sola vez por racha, y no por una caída pasajera.
    if (failuresInARow === CHECK_FAILURES_TO_REPORT) {
      await deps.failures.record({
        url: product.url,
        problem: error instanceof PriceUnavailableError ? error.problem : "unavailable",
        message,
        detail: error instanceof PriceUnavailableError ? (error.detail ?? null) : null,
        source: "check",
        userId: null,
      });
    }
    result.failed.push({ url: product.url, error: message });
    const detail = error instanceof PriceUnavailableError && error.detail ? ` (${error.detail})` : "";
    log(`Error en ${product.url}: ${message}${detail}`);
    return null;
  }
}

/** Colores incluidos en una línea, o el producto simple como única opción. */
function priceOptions(reading: PriceReading, excluded: readonly string[]): PriceOption[] {
  return reading.variants?.length ? includedVariants(reading.variants, excluded) : [reading];
}

function groupByHost(products: Product[]): Map<string, Product[]> {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const host = new URL(product.url).hostname;
    groups.set(host, [...(groups.get(host) ?? []), product]);
  }
  return groups;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
