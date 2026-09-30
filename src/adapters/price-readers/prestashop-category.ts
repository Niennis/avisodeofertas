import { PriceUnavailableError } from "@/core/domain/errors";
import { normalizeListPrice, type PriceReading } from "@/core/domain/price";
import { summarizeVariants, type ProductVariant } from "@/core/domain/variants";
import { fetchJson } from "./http-client";
import type { PlatformReader } from "./platform";

interface PrestaShopListing {
  label?: string;
  products?: {
    id_product: string;
    name: string;
    manufacturer_name?: string | null;
    price_amount: number;
    regular_price_amount: number;
    url: string;
    add_to_cart_url?: string | null;
    cover?: { bySize?: Record<string, { url: string }> } | null;
  }[];
  pagination?: { pages_count?: number };
}

/** Categorías de PrestaShop: `/2188-roma` (los productos, en cambio, terminan en `.html`). */
const CATEGORY_PATH = /^\/\d+-[^/.]+\/?$/;
const MAX_PAGES = 10;

/**
 * Categorías de PrestaShop (Reginella, ...) donde cada producto es un color de la misma línea.
 * PrestaShop entrega el listado en JSON al pedirlo con `?from-xhr`.
 */
export const prestaShopCategoryReader: PlatformReader = {
  name: "prestashop-categoria",

  matches: (url) => CATEGORY_PATH.test(url.pathname),

  async read(url) {
    const first = await fetchPage(url, 1);
    const pages = Math.min(first.pagination?.pages_count ?? 1, MAX_PAGES);
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => fetchPage(url, i + 2)));
    const products = [first, ...rest].flatMap((page) => page.products ?? []);
    if (products.length === 0) {
      throw new PriceUnavailableError("not_found", "Categoría sin productos", "Esta página de la tienda no tiene productos.");
    }

    const lineName = first.label?.replace(/^[^:]*:\s*/, "").trim() || url.pathname;
    const variants: ProductVariant[] = products.map((p) => ({
      key: p.id_product,
      name: stripPrefix(p.name, lineName),
      price: p.price_amount,
      listPrice: normalizeListPrice(p.price_amount, Math.round(p.regular_price_amount)),
      // Sin enlace de compra no hay certeza (puede estar agotado o la tienda en modo catálogo).
      available: p.add_to_cart_url ? true : null,
      url: p.url,
      imageUrl: p.cover?.bySize?.home_default?.url ?? null,
    }));

    return {
      name: lineName,
      brand: products.find((p) => p.manufacturer_name)?.manufacturer_name ?? null,
      imageUrl: variants[0].imageUrl,
      ...summarizeVariants(variants)!,
      currency: "CLP",
      variants,
    } satisfies PriceReading;
  },
};

function stripPrefix(name: string, prefix: string): string {
  const rest = name.toLowerCase().startsWith(`${prefix.toLowerCase()} `) ? name.slice(prefix.length + 1).trim() : "";
  return rest || name;
}

async function fetchPage(url: URL, page: number): Promise<PrestaShopListing> {
  const pageUrl = new URL(url);
  pageUrl.searchParams.set("from-xhr", "");
  if (page > 1) pageUrl.searchParams.set("page", String(page));
  const listing = await fetchJson<PrestaShopListing>(pageUrl.toString());
  if (!Array.isArray(listing?.products)) throw new PriceUnavailableError("unsupported", "No es una categoría PrestaShop");
  return listing;
}
