import { isOnSale } from "./price";
import type { PriceSnapshot } from "./product";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Período para el "precio más bajo". */
export const INSIGHT_WINDOW_DAYS = 90;
/** Historial mínimo para decir que un precio es el más bajo. */
export const MIN_HISTORY_DAYS = 14;
/**
 * Referencia para juzgar una rebaja: el precio más bajo de los 30 días anteriores a que empezara
 * (la misma regla que la directiva europea "Omnibus" exige a las tiendas para su precio "antes").
 */
export const PRE_SALE_DAYS = 30;
/** Días de historial antes de la rebaja necesarios para juzgarla. */
const MIN_PRE_SALE_DAYS = 7;
/** Una rebaja menor a esto, respecto de la referencia, se considera dudosa. */
const MIN_REAL_DISCOUNT = 0.03;

/** Qué tan real es la rebaja que muestra la tienda. */
export type SaleVerdict =
  /** Más barato que lo que costaba antes de la rebaja. */
  | { kind: "real"; referencePrice: number; realDiscount: number }
  /** En los 30 días previos ya costaba esto o menos: el precio "antes" de la tienda está inflado. */
  | { kind: "doubtful"; referencePrice: number }
  /** Está rebajado desde que empezamos a seguirlo: todavía no conocemos su precio normal. */
  | { kind: "since-start"; since: string }
  /** Muy poco historial antes de la rebaja para juzgarla. */
  | { kind: "unknown" };

/** Resumen del historial para decidir si conviene comprar ahora. Se guarda como JSON (fechas en ISO). */
export interface PriceInsight {
  /** Días de historial considerados (hasta 90). */
  historyDays: number;
  /** Primera lectura considerada. */
  since: string;
  /** Precio más bajo de los últimos 90 días (incluido el actual) y cuándo se vio por primera vez. */
  lowest: { price: number; at: string };
  /** El precio actual es más bajo que todos los anteriores de los últimos 90 días. */
  isLowest: boolean;
  /** Solo si la tienda lo muestra rebajado. */
  sale: SaleVerdict | null;
}

/** Analiza el historial (ordenado por fecha; la última lectura es el precio actual). */
export function analyzePriceHistory(history: readonly PriceSnapshot[], now: Date): PriceInsight | null {
  const windowStart = now.getTime() - INSIGHT_WINDOW_DAYS * DAY_MS;
  const recent = history.filter((h) => h.checkedAt.getTime() >= windowStart);
  if (recent.length === 0) return null;

  const current = recent[recent.length - 1];
  const first = recent[0];
  const historyDays = Math.floor((current.checkedAt.getTime() - first.checkedAt.getTime()) / DAY_MS);
  const lowest = recent.reduce((a, b) => (b.price < a.price ? b : a));
  // Lecturas anteriores a que llegara al precio actual: tiene que ser más barato que todas ellas.
  let runStart = recent.length - 1;
  while (runStart > 0 && recent[runStart - 1].price === current.price) runStart--;
  const previous = recent.slice(0, runStart);

  return {
    historyDays,
    since: first.checkedAt.toISOString(),
    lowest: { price: lowest.price, at: lowest.checkedAt.toISOString() },
    isLowest: historyDays >= MIN_HISTORY_DAYS && previous.length > 0 && previous.every((h) => h.price > current.price),
    sale: isOnSale(current.price, current.listPrice) ? judgeSale(history, current) : null,
  };
}

function judgeSale(history: readonly PriceSnapshot[], current: PriceSnapshot): SaleVerdict {
  // Inicio de la rebaja actual: la primera lectura de la racha de lecturas rebajadas que termina hoy.
  let start = history.length - 1;
  while (start > 0 && isOnSale(history[start - 1].price, history[start - 1].listPrice)) start--;
  if (start === 0) return { kind: "since-start", since: history[0].checkedAt.toISOString() };

  const saleStart = history[start].checkedAt.getTime();
  const before = history
    .slice(0, start)
    .filter((h) => h.checkedAt.getTime() >= saleStart - PRE_SALE_DAYS * DAY_MS);
  const covered = before.length > 0 ? (saleStart - before[0].checkedAt.getTime()) / DAY_MS : 0;
  if (covered < MIN_PRE_SALE_DAYS) return { kind: "unknown" };

  const referencePrice = Math.min(...before.map((h) => h.price));
  const realDiscount = (referencePrice - current.price) / referencePrice;
  if (realDiscount < MIN_REAL_DISCOUNT) return { kind: "doubtful", referencePrice };
  return { kind: "real", referencePrice, realDiscount: Math.round(realDiscount * 100) };
}
