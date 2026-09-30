import { INSIGHT_WINDOW_DAYS, MIN_HISTORY_DAYS, PRE_SALE_DAYS, type PriceInsight } from "@/core/domain/price-insight";
import { formatDate, formatMoney } from "./format";

export type InsightTone = "good" | "warn" | "neutral";

export interface InsightLine {
  text: string;
  tone: InsightTone;
}

/** "de los últimos 90 días" o, con menos historial, "desde que lo seguimos (20 días)". */
function periodText(insight: PriceInsight): string {
  return insight.historyDays >= INSIGHT_WINDOW_DAYS
    ? `de los últimos ${INSIGHT_WINDOW_DAYS} días`
    : `desde que lo seguimos (${insight.historyDays} ${insight.historyDays === 1 ? "día" : "días"})`;
}

/**
 * Frases para decidir si conviene comprar: si la rebaja es real y si es el precio más bajo.
 * `price` y `listPrice` son el precio actual y el precio "antes" que muestra la tienda.
 */
export function insightLines(
  insight: PriceInsight,
  { price, listPrice, currency }: { price: number | null; listPrice: number | null; currency: string },
): InsightLine[] {
  const money = (amount: number) => formatMoney(amount, currency);
  const lines: InsightLine[] = [];
  const sale = insight.sale;

  if (sale?.kind === "doubtful") {
    const inflated =
      listPrice != null && listPrice > sale.referencePrice ? `; la tienda muestra ${money(listPrice)} como precio anterior` : "";
    lines.push({
      tone: "warn",
      text: `Oferta dudosa: en los ${PRE_SALE_DAYS} días antes de la rebaja ya costaba ${money(sale.referencePrice)}${inflated}.`,
    });
  } else if (sale?.kind === "real") {
    lines.push({
      tone: "good",
      text: `Rebaja real: ${sale.realDiscount}% menos que su precio más bajo de los ${PRE_SALE_DAYS} días anteriores (${money(sale.referencePrice)}).`,
    });
  } else if (sale?.kind === "since-start") {
    lines.push({
      tone: "neutral",
      text: `Está rebajado desde que empezamos a seguirlo (${formatDate(new Date(sale.since))}), así que todavía no sabemos su precio normal.`,
    });
  } else if (sale?.kind === "unknown") {
    lines.push({ tone: "neutral", text: "Hay poco historial antes de esta rebaja para saber si es real." });
  }

  if (insight.isLowest) {
    lines.push({ tone: "good", text: `Es el precio más bajo ${periodText(insight)}.` });
  } else if (insight.historyDays < MIN_HISTORY_DAYS) {
    lines.push({
      tone: "neutral",
      text: "Con un par de semanas de historial te diremos si es el precio más bajo.",
    });
  } else if (price != null && price <= insight.lowest.price) {
    lines.push({ tone: "neutral", text: `Iguala el precio más bajo ${periodText(insight)}.` });
  } else {
    lines.push({
      tone: "neutral",
      text: `El precio más bajo ${periodText(insight)} fue ${money(insight.lowest.price)} (${formatDate(new Date(insight.lowest.at))}).`,
    });
  }
  return lines;
}

/** Distintivo corto para la tarjeta del producto; solo lo más relevante. */
export function insightBadge(insight: PriceInsight | null): InsightLine | null {
  if (!insight) return null;
  if (insight.sale?.kind === "doubtful") return { tone: "warn", text: "Oferta dudosa" };
  if (insight.isLowest) return { tone: "good", text: `Mínimo en ${Math.min(insight.historyDays, INSIGHT_WINDOW_DAYS)} días` };
  return null;
}
