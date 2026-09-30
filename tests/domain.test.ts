import { describe, expect, it } from "vitest";
import { evaluateAlert } from "@/core/domain/alert-policy";
import { discountPercent, normalizeListPrice } from "@/core/domain/price";
import { normalizeProductUrl, storeNameFromUrl } from "@/core/domain/product-url";

const base = { notifyOnSale: true, targetPrice: null, lastNotifiedPrice: null, available: true, listPrice: null };

describe("evaluateAlert", () => {
  it("avisa cuando el producto pasa a estar rebajado", () => {
    const decision = evaluateAlert({ ...base, price: 900, listPrice: 1000 });
    expect(decision).toEqual({ notify: true, reasons: ["on_sale"], nextLastNotifiedPrice: 900 });
  });

  it("no repite el aviso si el precio no bajó más", () => {
    const decision = evaluateAlert({ ...base, price: 900, listPrice: 1000, lastNotifiedPrice: 900 });
    expect(decision.notify).toBe(false);
    expect(decision.nextLastNotifiedPrice).toBe(900);
  });

  it("vuelve a avisar si baja todavía más", () => {
    expect(evaluateAlert({ ...base, price: 800, listPrice: 1000, lastNotifiedPrice: 900 }).notify).toBe(true);
  });

  it("reinicia cuando termina la oferta, para avisar en la siguiente", () => {
    const ended = evaluateAlert({ ...base, price: 1000, lastNotifiedPrice: 900 });
    expect(ended).toEqual({ notify: false, reasons: [], nextLastNotifiedPrice: null });
    expect(evaluateAlert({ ...base, price: 900, listPrice: 1000, lastNotifiedPrice: null }).notify).toBe(true);
  });

  it("avisa bajo el precio objetivo aunque la tienda no marque oferta", () => {
    const decision = evaluateAlert({ ...base, notifyOnSale: false, targetPrice: 5000, price: 4990 });
    expect(decision.reasons).toEqual(["below_target"]);
    expect(decision.notify).toBe(true);
  });

  it("ignora ofertas si el usuario solo quiere precio objetivo", () => {
    expect(evaluateAlert({ ...base, notifyOnSale: false, targetPrice: 500, price: 900, listPrice: 1000 }).notify).toBe(false);
  });

  it("no avisa si el producto está agotado", () => {
    expect(evaluateAlert({ ...base, price: 900, listPrice: 1000, available: false }).notify).toBe(false);
  });
});

describe("precios", () => {
  it("descarta precios de lista que no son mayores al actual", () => {
    expect(normalizeListPrice(6990, 5990)).toBeNull();
    expect(normalizeListPrice(6990, 6990)).toBeNull();
    expect(normalizeListPrice(1249, 1470)).toBe(1470);
  });

  it("calcula el porcentaje de descuento", () => {
    expect(discountPercent(1249, 1470)).toBe(15);
    expect(discountPercent(1000, null)).toBeNull();
  });
});

describe("normalizeProductUrl", () => {
  it("quita parámetros de seguimiento y conserva la variante", () => {
    expect(normalizeProductUrl("http://WWW.Orquidea.cl/products/bamboo/?utm_source=ig&variant=123#top")).toBe(
      "https://www.orquidea.cl/products/bamboo?variant=123",
    );
  });

  it("rechaza textos que no son URL", () => {
    expect(() => normalizeProductUrl("lana merino")).toThrow("URL válida");
  });

  it("reconoce el nombre de las tiendas conocidas", () => {
    expect(storeNameFromUrl("https://www.farmaciasahumada.cl/x-1.html")).toBe("Farmacias Ahumada");
    expect(storeNameFromUrl("https://tienda-nueva.cl/p/1")).toBe("tienda-nueva.cl");
  });
});
