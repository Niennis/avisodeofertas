import { describe, expect, it } from "vitest";
import { dealEmailHtml, dealEmailSubject, dealEmailText } from "@/adapters/notifications/deal-email";
import type { Deal } from "@/core/application/ports/notifier";

function deal(overrides: Partial<Deal>): Deal {
  return {
    productId: "p",
    name: "Lana Roma",
    store: "Reginella",
    url: "https://reginella.cl/roma",
    imageUrl: null,
    currency: "CLP",
    price: 2390,
    listPrice: null,
    targetPrice: null,
    reasons: ["on_sale"],
    variants: [],
    restockedVariants: [],
    insight: null,
    ...overrides,
  };
}

describe("email de avisos", () => {
  it("asunto y título según haya ofertas, stock o ambos", () => {
    const stock = deal({ reasons: ["back_in_stock"], restockedVariants: ["Negro", "Lila"] });
    const sale = deal({ price: 2032, listPrice: 2390 });

    expect(dealEmailSubject([stock])).toBe("Volvió a haber stock: Lana Roma");
    expect(dealEmailSubject([stock, stock])).toBe("2 productos que sigues volvieron a tener stock");
    expect(dealEmailSubject([stock, sale])).toBe("Novedades en 2 productos que sigues");
    expect(dealEmailSubject([sale])).toBe("Oferta: Lana Roma a $2.032");

    expect(dealEmailText([stock], null)).toContain("volvió a haber stock de Negro y Lila");
    expect(dealEmailHtml([stock], null)).toContain("¡Volvió el stock de productos que sigues!");
  });
});
