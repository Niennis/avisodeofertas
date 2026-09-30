import { isOnSale } from "./price";
import type { WatchSettings } from "./watch";

/** Por qué se avisa: rebaja, precio objetivo o regreso de stock (este último no depende del precio). */
export type AlertReason = "on_sale" | "below_target" | "back_in_stock";

export interface AlertDecision {
  notify: boolean;
  reasons: AlertReason[];
  /** Valor que debe guardarse como `lastNotifiedPrice` después de evaluar. */
  nextLastNotifiedPrice: number | null;
}

interface AlertInput extends WatchSettings {
  lastNotifiedPrice: number | null;
  price: number;
  listPrice: number | null;
  available: boolean | null;
}

/** Condiciones de aviso del usuario que el precio actual cumple. */
export function matchedReasons(
  settings: WatchSettings,
  price: number | null,
  listPrice: number | null,
): AlertReason[] {
  if (price == null) return [];
  const reasons: AlertReason[] = [];
  if (settings.notifyOnSale && isOnSale(price, listPrice)) reasons.push("on_sale");
  if (settings.targetPrice != null && price <= settings.targetPrice) reasons.push("below_target");
  return reasons;
}

export interface PriceOption {
  price: number;
  listPrice: number | null;
  available: boolean | null;
}

/** Opciones (colores o el producto simple) que cumplen alguna condición y no están agotadas. */
export function matchingOptions<T extends PriceOption>(settings: WatchSettings, options: T[]): T[] {
  return options.filter((o) => o.available !== false && matchedReasons(settings, o.price, o.listPrice).length > 0);
}

/**
 * Decide si corresponde avisar al usuario, mirando cada opción de precio por separado
 * (en una línea con varios colores, basta con que uno cumpla).
 *
 * Para no repetir avisos: mientras la condición se siga cumpliendo, solo se vuelve a
 * avisar si el precio más bajo que la cumple baja todavía más. Cuando deja de cumplirse
 * se reinicia, de modo que la próxima oferta vuelve a generar aviso.
 */
export function evaluateAlertOptions<T extends PriceOption>(
  settings: WatchSettings & { lastNotifiedPrice: number | null },
  options: T[],
): AlertDecision & { matching: T[] } {
  const matching = matchingOptions(settings, options);
  if (matching.length === 0) return { notify: false, reasons: [], nextLastNotifiedPrice: null, matching };

  const reasons = [...new Set(matching.flatMap((o) => matchedReasons(settings, o.price, o.listPrice)))];
  const best = Math.min(...matching.map((o) => o.price));
  const alreadyNotified = settings.lastNotifiedPrice != null && best >= settings.lastNotifiedPrice;
  if (alreadyNotified) {
    return { notify: false, reasons, nextLastNotifiedPrice: settings.lastNotifiedPrice, matching };
  }
  return { notify: true, reasons, nextLastNotifiedPrice: best, matching };
}

/** Versión para un producto simple. */
export function evaluateAlert(input: AlertInput): AlertDecision {
  const { notify, reasons, nextLastNotifiedPrice } = evaluateAlertOptions(input, [input]);
  return { notify, reasons, nextLastNotifiedPrice };
}
