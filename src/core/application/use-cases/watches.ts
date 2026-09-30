import { DomainError, NotFoundError, PriceUnavailableError } from "@/core/domain/errors";
import type { PriceReading } from "@/core/domain/price";
import type { PriceSnapshot } from "@/core/domain/product";
import { findColorsFollowedSeparately, findLineContaining, type ColorInLine, type SeparateColor } from "@/core/domain/duplicates";
import { normalizeProductUrl, sameProductUrl, storeNameFromUrl } from "@/core/domain/product-url";
import type { WatchSettings, WatchWithProduct } from "@/core/domain/watch";
import type { Clock } from "../ports/clock";
import type { PriceReader } from "../ports/price-reader";
import type { ProductRepository } from "../ports/product-repository";
import type { FailureRepository } from "../ports/failure-repository";
import type { GroupRepository } from "../ports/group-repository";
import type { WatchRepository } from "../ports/watch-repository";
import { dissolveIfTooSmall } from "./groups";
import { refreshPriceInsight } from "./price-insight";

const HISTORY_DAYS = 180;
/** "Actualizar precio" no vuelve a consultar la tienda si se revisó hace menos que esto. */
export const REFRESH_COOLDOWN_MINUTES = 5;

export interface WatchDeps {
  products: ProductRepository;
  failures: FailureRepository;
  watches: WatchRepository;
  groups: GroupRepository;
  priceReader: PriceReader;
  clock: Clock;
}

/** Qué hacer cuando el enlace choca con algo que ya sigue. */
export type AddResolution =
  /** Seguir el color como producto aparte aunque esté en una línea. */
  | "separate"
  /** Volver a marcar el color en la línea donde estaba desmarcado. */
  | "include-in-line"
  /** Reemplazar los colores sueltos por la línea con todos sus colores. */
  | "line-all"
  /** Reemplazar los colores sueltos por la línea, marcando solo esos colores. */
  | "line-only-mine";

export type AddWatchResult =
  | { status: "added"; watchId: string; name: string; variantCount: number; replaced: number }
  | { status: "included-in-line"; watchId: string; name: string; colorName: string }
  | ({ status: "color-in-line" } & ColorInLine)
  | { status: "line-has-colors"; name: string; colors: SeparateColor[] };

export class WatchService {
  constructor(private readonly deps: WatchDeps) {}

  list(userId: string): Promise<WatchWithProduct[]> {
    return this.deps.watches.listByUser(userId);
  }

  /**
   * Comienza a seguir un producto o una línea de colores. Si nadie lo seguía, lee el precio
   * en el momento para validar que la tienda sea compatible y mostrar nombre e imagen.
   *
   * Evita tarjetas repetidas: si el enlace es un color de una línea que ya sigue, o una
   * línea con colores que ya sigue por separado, no crea nada y devuelve el conflicto
   * para que la persona elija (`resolution`) qué hacer.
   */
  async add(
    userId: string,
    rawUrl: string,
    settings: WatchSettings,
    resolution?: AddResolution,
  ): Promise<AddWatchResult> {
    const { products, watches, clock } = this.deps;
    validateSettings(settings);
    const url = normalizeProductUrl(rawUrl);
    const mine = await watches.listByUser(userId);
    if (mine.some((w) => sameProductUrl(w.product.url, url))) {
      throw new DomainError("Ya estás siguiendo este producto.");
    }

    const inLine = findLineContaining(url, mine);
    if (inLine && resolution !== "separate") {
      if (resolution === "include-in-line" && inLine.excluded) {
        const line = mine.find((w) => w.id === inLine.lineWatchId)!;
        await watches.setExcludedVariants(line.id, line.excludedVariants.filter((key) => key !== inLine.colorKey));
        await watches.updateLastNotified(line.id, null, null);
        return { status: "included-in-line", watchId: line.id, name: inLine.lineName, colorName: inLine.colorName };
      }
      return { status: "color-in-line", ...inLine };
    }

    let product = await products.findByUrl(url);
    if (!product) {
      const reading = await this.readReportingFailures(userId, url);
      const checkedAt = clock.now();
      product = await products.create({ url, store: storeNameFromUrl(url), reading, checkedAt });
      await refreshPriceInsight(products, product.id, checkedAt);
    }

    const separate = product.variants.length > 1 ? findColorsFollowedSeparately(product, mine) : [];
    if (separate.length > 0 && resolution !== "line-all" && resolution !== "line-only-mine") {
      return { status: "line-has-colors", name: product.name, colors: separate };
    }

    const watch = await watches.create(userId, product.id, settings);
    if (separate.length > 0) {
      if (resolution === "line-only-mine") {
        const keep = new Set(separate.map((c) => c.key));
        await watches.setExcludedVariants(
          watch.id,
          product.variants.map((v) => v.key).filter((key) => !keep.has(key)),
        );
      }
      // La línea reemplaza a las tarjetas de los colores sueltos.
      for (const color of separate) await watches.delete(color.watchId);
      await products.deleteOrphans();
    }
    return {
      status: "added",
      watchId: watch.id,
      name: product.name,
      variantCount: resolution === "line-only-mine" ? separate.length : product.variants.length,
      replaced: separate.length,
    };
  }

  async update(userId: string, watchId: string, settings: WatchSettings): Promise<void> {
    validateSettings(settings);
    await this.get(userId, watchId);
    await this.deps.watches.updateSettings(watchId, settings);
    // Con condiciones nuevas corresponde volver a evaluar desde cero.
    await this.deps.watches.updateLastNotified(watchId, null, null);
  }

  /** Guarda qué colores de una línea no quiere seguir. Recibe los que sí quiere. */
  async selectVariants(userId: string, watchId: string, includedKeys: string[]): Promise<void> {
    const watch = await this.get(userId, watchId);
    const keys = new Set(includedKeys);
    const excluded = watch.product.variants.map((v) => v.key).filter((key) => !keys.has(key));
    if (excluded.length === watch.product.variants.length) {
      throw new DomainError("Elige al menos un color.");
    }
    await this.deps.watches.setExcludedVariants(watchId, excluded);
    // Con otro conjunto de colores corresponde volver a evaluar desde cero.
    await this.deps.watches.updateLastNotified(watchId, null, null);
  }

  async remove(userId: string, watchId: string): Promise<void> {
    const watch = await this.get(userId, watchId);
    await this.deps.watches.delete(watchId);
    if (watch.groupId) {
      const remaining = (await this.deps.watches.listByUser(userId)).filter((w) => w.groupId === watch.groupId);
      await dissolveIfTooSmall(this.deps, watch.groupId, remaining.length);
    }
    await this.deps.products.deleteOrphans();
  }

  async detail(userId: string, watchId: string): Promise<{ watch: WatchWithProduct; history: PriceSnapshot[] }> {
    const watch = await this.get(userId, watchId);
    const since = new Date(this.deps.clock.now().getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000);
    const history = await this.deps.products.history(watch.productId, since);
    return { watch, history };
  }

  /**
   * "Actualizar precio": lee ahora el precio de un producto que sigue y lo guarda en el historial.
   * No envía avisos; si hay una oferta, se avisa en la próxima revisión programada.
   */
  async refresh(userId: string, watchId: string): Promise<"updated" | "recent"> {
    const { products, priceReader, clock } = this.deps;
    const { product } = await this.get(userId, watchId);
    const now = clock.now();
    // Solo si esa revisión salió bien: si falló, vale la pena intentar de nuevo.
    const checkedRecently =
      product.lastCheckedAt != null && now.getTime() - product.lastCheckedAt.getTime() < REFRESH_COOLDOWN_MINUTES * 60 * 1000;
    if (checkedRecently && !product.lastError) {
      return "recent";
    }
    let reading: PriceReading;
    try {
      reading = await priceReader.read(product.url);
    } catch (error) {
      // No se registra como fallo: la revisión programada se encarga de eso.
      if (error instanceof PriceUnavailableError) throw error;
      throw new DomainError("No pudimos consultar la tienda en este momento. Intenta de nuevo en un rato.");
    }
    await products.recordReading(product.id, reading, now);
    await refreshPriceInsight(products, product.id, now);
    return "updated";
  }

  /** Lee el precio; si falla, lo registra para quien administra la app. */
  private async readReportingFailures(userId: string, url: string): Promise<PriceReading> {
    try {
      return await this.deps.priceReader.read(url);
    } catch (error) {
      if (!(error instanceof PriceUnavailableError)) throw error;
      await this.deps.failures.record({
        url,
        problem: error.problem,
        message: error.message,
        detail: error.detail ?? null,
        source: "add",
        userId,
      });
      // Si hace falta cambiar la app (tienda no compatible o que bloquea), se le cuenta que quedó registrado.
      if (error.problem === "unsupported" || error.problem === "blocked") {
        throw new PriceUnavailableError(error.problem, error.detail, `${error.message} Ya quedó registrado para revisarlo.`);
      }
      throw error;
    }
  }

  private async get(userId: string, watchId: string): Promise<WatchWithProduct> {
    const watch = await this.deps.watches.findForUser(userId, watchId);
    if (!watch) throw new NotFoundError("No encontramos ese producto en tu lista.");
    return watch;
  }
}

function validateSettings(settings: WatchSettings) {
  if (settings.targetPrice != null && !(settings.targetPrice > 0)) {
    throw new DomainError("El precio objetivo debe ser mayor que cero.");
  }
  if (!settings.notifyOnSale && settings.targetPrice == null) {
    throw new DomainError("Elige al menos una condición de aviso.");
  }
}
