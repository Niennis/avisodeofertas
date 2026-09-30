import type { CheerioAPI } from "cheerio";
import { parsePrice } from "../parse-price";

type JsonObject = Record<string, unknown>;

export interface JsonLdProduct {
  name: string | null;
  brand: string | null;
  image: string | null;
  /** Precio más bajo entre las ofertas publicadas. */
  price: number | null;
  /** Precio tachado declarado con `priceSpecification` de tipo `StrikethroughPrice`/`ListPrice`. */
  listPrice: number | null;
  currency: string | null;
  available: boolean | null;
}

/** Busca el primer objeto `Product` en los bloques JSON-LD de la página (incluye `@graph`). */
export function readJsonLdProduct($: CheerioAPI): JsonLdProduct | null {
  for (const element of $('script[type="application/ld+json"]').toArray()) {
    let data: unknown;
    try {
      data = JSON.parse($(element).text());
    } catch {
      continue;
    }
    const product = findProduct(data);
    if (product) return describeProduct(product);
  }
  return null;
}

function findProduct(node: unknown): JsonObject | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProduct(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const object = node as JsonObject;
  const type = object["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return object;
  return findProduct(object["@graph"]);
}

function describeProduct(product: JsonObject): JsonLdProduct {
  const offers = toArray(product.offers).flatMap((offer) => {
    const o = offer as JsonObject;
    return o["@type"] === "AggregateOffer" ? [{ ...o, price: o.lowPrice ?? o.price }] : [o];
  });

  const prices = offers.map((o) => parsePrice(o.price as string | number)).filter((p): p is number => p != null);
  const listPrices = offers
    .flatMap((o) => toArray(o.priceSpecification))
    .filter((spec) => /Strikethrough|ListPrice/i.test(String((spec as JsonObject).priceType ?? "")))
    .map((spec) => parsePrice((spec as JsonObject).price as string | number))
    .filter((p): p is number => p != null);
  const availability = offers.map((o) => String(o.availability ?? "")).find(Boolean);

  return {
    name: typeof product.name === "string" ? product.name : null,
    brand: brandName(product.brand),
    image: firstImage(product.image),
    price: prices.length ? Math.min(...prices) : null,
    listPrice: listPrices.length ? Math.max(...listPrices) : null,
    currency: (offers.find((o) => o.priceCurrency)?.priceCurrency as string | undefined) ?? null,
    available: availability ? /InStock|LimitedAvailability|PreOrder/i.test(availability) : null,
  };
}

function brandName(brand: unknown): string | null {
  const first = toArray(brand)[0];
  const name = typeof first === "string" ? first : ((first as JsonObject | undefined)?.name as string | undefined);
  return name?.trim() || null;
}

function firstImage(image: unknown): string | null {
  const first = toArray(image)[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object") return ((first as JsonObject).url as string) ?? null;
  return null;
}

function toArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function metaContent($: CheerioAPI, ...properties: string[]): string | null {
  for (const property of properties) {
    const value = $(`meta[property="${property}"], meta[name="${property}"], meta[itemprop="${property}"]`)
      .first()
      .attr("content");
    if (value) return value.trim();
  }
  return null;
}

export function pageTitle($: CheerioAPI): string | null {
  return metaContent($, "og:title") ?? ($("h1").first().text().trim() || null);
}

export function pageImage($: CheerioAPI, baseUrl: URL): string | null {
  const src = metaContent($, "og:image", "og:image:secure_url");
  if (!src) return null;
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}
