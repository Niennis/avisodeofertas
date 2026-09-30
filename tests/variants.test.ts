import { describe, expect, it } from "vitest";
import { variantsText } from "@/adapters/notifications/deal-email";
import { evaluateAlertOptions } from "@/core/domain/alert-policy";
import { includedVariants, summarizeVariants, type ProductVariant } from "@/core/domain/variants";

function color(key: string, price: number, listPrice: number | null = null, available: boolean | null = true): ProductVariant {
  return { key, name: key, price, listPrice, available, url: null, imageUrl: null };
}

describe("summarizeVariants", () => {
  it("destaca el color rebajado más barato aunque haya otro más barato sin rebaja", () => {
    expect(summarizeVariants([color("a", 1000), color("b", 1200, 1500), color("c", 1300, 1600)])).toEqual({
      price: 1200,
      listPrice: 1500,
      available: true,
    });
  });

  it("sin rebajas, el más barato", () => {
    expect(summarizeVariants([color("a", 2000), color("b", 1800)])?.price).toBe(1800);
  });

  it("ignora los agotados salvo que lo estén todos", () => {
    expect(summarizeVariants([color("a", 900, 1200, false), color("b", 1100)])?.price).toBe(1100);
    expect(summarizeVariants([color("a", 900, null, false), color("b", 1100, null, false)])).toMatchObject({
      price: 900,
      available: false,
    });
  });

  it("línea vacía", () => {
    expect(summarizeVariants([])).toBeNull();
  });
});

describe("evaluateAlertOptions", () => {
  const settings = { notifyOnSale: true, targetPrice: null, lastNotifiedPrice: null };

  it("avisa si cualquier color está en oferta y dice cuáles", () => {
    const decision = evaluateAlertOptions(settings, [color("a", 1000), color("b", 1200, 1500), color("c", 1300, 1600)]);
    expect(decision.notify).toBe(true);
    expect(decision.matching.map((v) => v.key)).toEqual(["b", "c"]);
    expect(decision.nextLastNotifiedPrice).toBe(1200);
  });

  it("no cuenta los colores desmarcados", () => {
    const line = [color("a", 1000), color("b", 1200, 1500)];
    expect(evaluateAlertOptions(settings, includedVariants(line, ["b"])).notify).toBe(false);
  });

  it("el precio objetivo se compara color por color", () => {
    const decision = evaluateAlertOptions({ ...settings, notifyOnSale: false, targetPrice: 1100 }, [
      color("a", 1000),
      color("b", 1200),
    ]);
    expect(decision.matching.map((v) => v.key)).toEqual(["a"]);
    expect(decision.reasons).toEqual(["below_target"]);
  });
});

it("resume los nombres de colores para el email", () => {
  expect(variantsText(["Beige"])).toBe("Beige");
  expect(variantsText(["Beige", "Lila"])).toBe("Beige y Lila");
  expect(variantsText(["A", "B", "C", "D", "E"])).toBe("A, B, C y 2 colores más");
});
