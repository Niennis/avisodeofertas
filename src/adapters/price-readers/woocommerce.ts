import * as cheerio from "cheerio";
import { PriceUnavailableError } from "@/core/domain/errors";
import { normalizeListPrice, type PriceReading } from "@/core/domain/price";
import { fetchJson } from "./http-client";
import type { PlatformReader } from "./platform";

interface WooProduct {
  name: string;
  brands?: { name: string }[];
  is_in_stock: boolean;
  images: { src: string }[];
  prices: {
    price: string;
    regular_price: string;
    currency_code: string;
    currency_minor_unit: number;
    price_range: { min_amount: string; max_amount: string } | null;
  };
}

const PRODUCT_PATH = /\/(?:producto|product)\/([^/?#]+)/;

/**
 * Tiendas WooCommerce (Lana Móvil, ...). Usa la Store API pública
 * `wp-json/wc/store/v1/products?slug=...`, con precios en unidades mínimas.
 */
export const wooCommerceReader: PlatformReader = {
  name: "woocommerce",

  matches: (url) => PRODUCT_PATH.test(url.pathname),

  async read(url) {
    const slug = PRODUCT_PATH.exec(url.pathname)![1];
    const results = await fetchJson<WooProduct[]>(
      `${url.origin}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`,
    );
    const product = Array.isArray(results) ? results[0] : undefined;
    if (!product?.prices) throw new PriceUnavailableError("unsupported", "No es un producto WooCommerce");

    const { prices } = product;
    const toAmount = (value: string) => Number(value) / 10 ** prices.currency_minor_unit;
    const price = toAmount(prices.price_range?.min_amount ?? prices.price);
    return {
      name: cheerio.load(product.name).text(),
      brand: product.brands?.[0]?.name ?? null,
      imageUrl: product.images[0]?.src ?? null,
      price,
      listPrice: prices.price_range ? null : normalizeListPrice(price, toAmount(prices.regular_price)),
      currency: prices.currency_code,
      available: product.is_in_stock,
    } satisfies PriceReading;
  },
};
