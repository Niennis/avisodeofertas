import { isValidPrice, normalizeListPrice } from "@/core/domain/price";
import { parsePrice } from "../parse-price";
import type { HtmlExtractor } from "../platform";
import { metaContent, pageImage, pageTitle, readJsonLdProduct } from "./structured-data";

/**
 * Farmacias Ahumada (Salesforce Commerce Cloud / "demandware").
 * El precio vigente está en `.sales .value[content]` y, si hay rebaja,
 * el precio normal en `.strike-through.list .value[content]`.
 */
export const ahumadaExtractor: HtmlExtractor = {
  name: "ahumada",
  extract($, url) {
    if (!url.hostname.endsWith("farmaciasahumada.cl")) return null;
    const detail = $(".product-detail").first();
    const prices = (detail.length ? detail : $("body")).find(".prices").first();
    const price = parsePrice(prices.find(".sales .value").first().attr("content"));
    if (!isValidPrice(price)) return null;
    const listPrice = parsePrice(prices.find(".strike-through.list .value").first().attr("content"));
    const jsonLd = readJsonLdProduct($);
    return {
      name: $("h1.product-name").first().text().trim() || jsonLd?.name || pageTitle($) || url.pathname,
      brand: detail.find(".brand").first().text().trim() || jsonLd?.brand || null,
      imageUrl: jsonLd?.image ?? pageImage($, url),
      price,
      listPrice: normalizeListPrice(price, listPrice),
      currency: "CLP",
      available: jsonLd?.available ?? null,
    };
  },
};

/**
 * Salcobrand (Spree). En `#product-price` muestra el "Precio Farmacia" (`.normal`)
 * y, si existe, uno o más precios rebajados (`.offer-price`, p. ej. "Precio Internet").
 */
export const salcobrandExtractor: HtmlExtractor = {
  name: "salcobrand",
  extract($, url) {
    const block = $("#product-price").first();
    if (!block.length) return null;
    const normal = parsePrice(block.find(".normal .display-price").first().text());
    const offers = block
      .find(".offer-price .display-price")
      .toArray()
      .map((el) => parsePrice($(el).text()))
      .filter(isValidPrice);
    const candidates = [normal, ...offers].filter(isValidPrice);
    if (!candidates.length) return null;
    const price = Math.min(...candidates);
    const jsonLd = readJsonLdProduct($);
    return {
      name: jsonLd?.name ?? pageTitle($) ?? url.pathname,
      brand: jsonLd?.brand ?? metaContent($, "product:brand", "og:brand"),
      imageUrl: jsonLd?.image ?? pageImage($, url),
      price,
      listPrice: normalizeListPrice(price, normal),
      currency: jsonLd?.currency ?? "CLP",
      available: jsonLd?.available ?? null,
    };
  },
};

/**
 * PrestaShop (Reginella, ...). El precio vigente está en `.current-price-value[content]`
 * y el precio antes del descuento en `.product-discount .regular-price`.
 */
export const prestaShopExtractor: HtmlExtractor = {
  name: "prestashop",
  extract($, url) {
    const block = $(".product-prices").first();
    if (!block.length) return null;
    const current = block.find(".current-price-value, [itemprop=price]").first();
    const price = parsePrice(current.attr("content") ?? current.text());
    if (!isValidPrice(price)) return null;
    const listPrice = parsePrice(block.find(".product-discount .regular-price, .regular-price").first().text());
    const jsonLd = readJsonLdProduct($);
    return {
      name: jsonLd?.name ?? pageTitle($) ?? url.pathname,
      brand: jsonLd?.brand ?? metaContent($, "product:brand", "og:brand"),
      imageUrl: jsonLd?.image ?? pageImage($, url),
      price,
      listPrice: normalizeListPrice(price, listPrice),
      currency: jsonLd?.currency ?? metaContent($, "product:price:currency") ?? "CLP",
      available: jsonLd?.available ?? null,
    };
  },
};

/**
 * Extractor genérico para cualquier tienda que publique datos estructurados:
 * metaetiquetas Open Graph de producto (Jumpseller, Tiendanube, ...) y JSON-LD `Product`.
 */
export const structuredDataExtractor: HtmlExtractor = {
  name: "structured-data",
  extract($, url) {
    const jsonLd = readJsonLdProduct($);
    const metaSale = parsePrice(metaContent($, "product:sale_price:amount"));
    const metaPrice = parsePrice(metaContent($, "product:price:amount", "og:price:amount"));
    const metaOriginal = parsePrice(metaContent($, "product:original_price:amount"));

    const price = [metaSale, jsonLd?.price, metaPrice].find(isValidPrice);
    if (!price) return null;
    const listPrice = [metaOriginal, jsonLd?.listPrice].find(isValidPrice) ?? null;
    const outOfStock = /out.?of.?stock|oos/i.test(metaContent($, "product:availability", "og:availability") ?? "");

    return {
      name: jsonLd?.name ?? pageTitle($) ?? url.pathname,
      brand: jsonLd?.brand ?? metaContent($, "product:brand", "og:brand"),
      imageUrl: jsonLd?.image ?? pageImage($, url),
      price,
      listPrice: normalizeListPrice(price, listPrice),
      currency:
        jsonLd?.currency ?? metaContent($, "product:price:currency", "og:price:currency") ?? "CLP",
      available: outOfStock ? false : (jsonLd?.available ?? null),
    };
  },
};

/** Orden de prueba: primero los específicos, al final el genérico. */
export const htmlExtractors: HtmlExtractor[] = [
  ahumadaExtractor,
  salcobrandExtractor,
  prestaShopExtractor,
  structuredDataExtractor,
];
