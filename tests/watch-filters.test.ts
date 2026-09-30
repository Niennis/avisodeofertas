import { describe, expect, it } from "vitest";
import type { WatchWithProduct } from "@/core/domain/watch";
import {
  applyFilters,
  DEFAULT_FILTERS,
  entryName,
  filtersToQuery,
  parseFilters,
  storeCounts,
  toEntries,
  type WatchFilters,
} from "@/web/watch-filters";

let sequence = 0;

function watch(
  name: string,
  store: string,
  price: number | null,
  options: { listPrice?: number; targetPrice?: number; lastError?: string; brand?: string; groupId?: string } = {},
): WatchWithProduct {
  sequence++;
  const createdAt = new Date(2026, 8, sequence);
  return {
    id: `w${sequence}`,
    userId: "u1",
    productId: `p${sequence}`,
    targetPrice: options.targetPrice ?? null,
    notifyOnSale: true,
    notifyOnRestock: false,
    lastRestockNotifiedAt: null,
    lastNotifiedPrice: null,
    lastNotifiedAt: null,
    excludedVariants: [],
    groupId: options.groupId ?? null,
    createdAt,
    product: {
      id: `p${sequence}`,
      url: `https://tienda.cl/${sequence}`,
      store,
      name,
      brand: options.brand ?? null,
      imageUrl: null,
      currency: "CLP",
      price,
      listPrice: options.listPrice ?? null,
      available: true,
      variants: [],
      priceInsight: null,
      restocks: {},
      lastCheckedAt: createdAt,
      lastError: options.lastError ?? null,
      consecutiveFailures: 0,
      createdAt,
    },
  };
}

const list = [
  watch("Merino Extrafino 100 g", "Orquídea", 5990, { listPrice: 6990 }),
  watch("Merino Extrafino", "Revés Derecho", 5490),
  watch("Algodón Paris Blanco", "Reginella", 1249, { listPrice: 1470 }),
  watch("Protector Solar FPS 50", "Salcobrand", 9990, { targetPrice: 10000 }),
  watch("Lana Bamboo", "Orquídea", null, { lastError: "La tienda no respondió a tiempo" }),
];

const names = (filters: Partial<WatchFilters>, entries = toEntries(list, [])) =>
  applyFilters(entries, { ...DEFAULT_FILTERS, ...filters }).map(entryName);

describe("applyFilters", () => {
  it("busca sin distinguir tildes ni mayúsculas", () => {
    expect(names({ q: "ALGODON" })).toEqual(["Algodón Paris Blanco"]);
  });

  it("exige todas las palabras, en el nombre o la tienda", () => {
    expect(names({ q: "merino orquidea" })).toEqual(["Merino Extrafino 100 g"]);
  });

  it("compara el mismo producto entre tiendas ordenando por precio", () => {
    expect(names({ q: "merino", orden: "precio" })).toEqual(["Merino Extrafino", "Merino Extrafino 100 g"]);
  });

  it("filtra por tienda", () => {
    expect(names({ tienda: "Orquídea" })).toEqual(["Lana Bamboo", "Merino Extrafino 100 g"]);
  });

  it("en oferta incluye rebajas y precios bajo el objetivo", () => {
    expect(names({ estado: "oferta" })).toEqual([
      "Protector Solar FPS 50",
      "Algodón Paris Blanco",
      "Merino Extrafino 100 g",
    ]);
    expect(names({ estado: "sin-oferta" })).toEqual(["Lana Bamboo", "Merino Extrafino"]);
  });

  it("muestra los productos que no se pudieron revisar", () => {
    expect(names({ estado: "problemas" })).toEqual(["Lana Bamboo"]);
  });

  it("ordena por descuento y deja los productos sin precio al final al ordenar por precio", () => {
    expect(names({ orden: "descuento" }).slice(0, 2)).toEqual(["Algodón Paris Blanco", "Merino Extrafino 100 g"]);
    expect(names({ orden: "precio" }).at(-1)).toBe("Lana Bamboo");
  });
});

describe("filtros en la URL", () => {
  it("ida y vuelta", () => {
    const filters: WatchFilters = { q: "merino", tienda: "Orquídea", estado: "oferta", orden: "precio" };
    const params = Object.fromEntries(new URLSearchParams(filtersToQuery(filters)));
    expect(parseFilters(params)).toEqual(filters);
  });

  it("omite los valores por defecto e ignora valores inválidos", () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe("");
    expect(parseFilters({ estado: "cualquiera", orden: ["precio", "nombre"] })).toEqual({
      ...DEFAULT_FILTERS,
      orden: "precio",
    });
  });
});

it("cuenta productos por tienda", () => {
  expect(storeCounts(toEntries(list, []))).toEqual([
    { store: "Orquídea", count: 2 },
    { store: "Reginella", count: 1 },
    { store: "Revés Derecho", count: 1 },
    { store: "Salcobrand", count: 1 },
  ]);
});

describe("grupos de mismo producto en varias tiendas", () => {
  const group = { id: "g1", userId: "u1", name: "Gel limpiador CeraVe", createdAt: new Date(2026, 8, 30) };
  const gel = [
    watch("Gel Limpiador Espumoso 236 ml", "Cruz Verde", 12990, { brand: "CeraVe", groupId: "g1" }),
    watch("CeraVe Limpiador Espumoso", "Farmacias Ahumada", 11490, { listPrice: 13990, groupId: "g1" }),
    watch("Limpiador facial piel grasa", "Salcobrand", 10990, { brand: "CERAVE", groupId: "g1" }),
  ];
  const entries = toEntries([...list, ...gel], [group]);

  it("junta las tiendas del grupo en una sola tarjeta", () => {
    expect(entries.filter((e) => e.kind === "group")).toHaveLength(1);
    expect(entries).toHaveLength(list.length + 1);
  });

  it("encuentra el grupo por su nombre, por la marca o por el nombre en cualquier tienda", () => {
    expect(names({ q: "gel cerave" }, entries)).toEqual(["Gel limpiador CeraVe"]);
    expect(names({ q: "piel grasa" }, entries)).toEqual(["Gel limpiador CeraVe"]);
    expect(names({ q: "cerave" }, toEntries(gel, []))).toHaveLength(3);
  });

  it("filtra por tienda si cualquiera de las del grupo coincide, y cuenta cada tienda", () => {
    expect(names({ tienda: "Salcobrand" }, entries)).toEqual(["Gel limpiador CeraVe", "Protector Solar FPS 50"]);
    expect(storeCounts(entries).find((s) => s.store === "Cruz Verde")?.count).toBe(1);
  });

  it("está en oferta si alguna tienda lo está, y ordena por su mejor precio", () => {
    expect(names({ estado: "oferta" }, entries)).toContain("Gel limpiador CeraVe");
    const byPrice = names({ orden: "precio" }, entries);
    expect(byPrice.indexOf("Gel limpiador CeraVe")).toBeGreaterThan(byPrice.indexOf("Merino Extrafino 100 g"));
  });
});
