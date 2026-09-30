import { describe, expect, it } from "vitest";
import { analyzePriceHistory } from "@/core/domain/price-insight";
import type { PriceSnapshot } from "@/core/domain/product";

const NOW = new Date("2026-10-01T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

/** Una lectura diaria: `[díasAtrás, precio, precioAntes?]`. */
function history(...points: [number, number, number?][]): PriceSnapshot[] {
  return points.map(([daysAgo, price, listPrice]) => ({
    price,
    listPrice: listPrice ?? null,
    available: true,
    checkedAt: new Date(NOW.getTime() - daysAgo * DAY),
  }));
}

/** Mismo precio todos los días, desde `from` hasta `to` días atrás. */
function days(from: number, to: number, price: number, listPrice?: number): [number, number, number?][] {
  const out: [number, number, number?][] = [];
  for (let d = from; d >= to; d--) out.push([d, price, listPrice]);
  return out;
}

describe("¿es buena oferta?", () => {
  it("rebaja real: más barato que lo que costaba en los 30 días previos", () => {
    const insight = analyzePriceHistory(history(...days(60, 5, 10000), ...days(4, 0, 8000, 10000)), NOW)!;
    expect(insight.sale).toEqual({ kind: "real", referencePrice: 10000, realDiscount: 20 });
    expect(insight.isLowest).toBe(true);
  });

  it("oferta dudosa: la tienda subió el precio justo antes de 'rebajarlo'", () => {
    const insight = analyzePriceHistory(
      history(...days(60, 15, 10000), ...days(14, 5, 13000), ...days(4, 0, 10000, 13000)),
      NOW,
    )!;
    expect(insight.sale).toEqual({ kind: "doubtful", referencePrice: 10000 });
    expect(insight.isLowest).toBe(false);
  });

  it("oferta dudosa: el precio 'antes' nunca se cobró", () => {
    const insight = analyzePriceHistory(history(...days(40, 5, 9990), ...days(4, 0, 9990, 14990)), NOW)!;
    expect(insight.sale).toEqual({ kind: "doubtful", referencePrice: 9990 });
  });

  it("si está rebajado desde que lo sigue, todavía no se sabe su precio normal", () => {
    const insight = analyzePriceHistory(history(...days(20, 0, 8000, 10000)), NOW)!;
    expect(insight.sale).toEqual({ kind: "since-start", since: new Date(NOW.getTime() - 20 * DAY).toISOString() });
  });

  it("con pocos días antes de la rebaja no la juzga", () => {
    const insight = analyzePriceHistory(history(...days(6, 3, 10000), ...days(2, 0, 8000, 10000)), NOW)!;
    expect(insight.sale).toEqual({ kind: "unknown" });
  });

  it("sin rebaja no hay veredicto de oferta, pero sí mínimo de 90 días", () => {
    const insight = analyzePriceHistory(history(...days(120, 91, 7000), ...days(90, 20, 9000), ...days(19, 0, 8500)), NOW)!;
    expect(insight.sale).toBeNull();
    // Lo de hace más de 90 días no cuenta.
    expect(insight.lowest.price).toBe(8500);
    expect(insight.historyDays).toBe(90);
  });

  it("el precio más bajo exige historial suficiente y ser menor que todos los anteriores", () => {
    expect(analyzePriceHistory(history(...days(10, 1, 9000), [0, 8000]), NOW)!.isLowest).toBe(false);
    expect(analyzePriceHistory(history(...days(30, 0, 9000)), NOW)!.isLowest).toBe(false);
    expect(analyzePriceHistory(history(...days(30, 1, 9000), [0, 8000]), NOW)!.isLowest).toBe(true);
    // Sigue siendo el más bajo mientras se mantenga.
    expect(analyzePriceHistory(history(...days(30, 5, 9000), ...days(4, 0, 8000)), NOW)!.isLowest).toBe(true);
  });

  it("sin historial no hay análisis", () => {
    expect(analyzePriceHistory([], NOW)).toBeNull();
  });
});
