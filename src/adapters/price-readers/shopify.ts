import { PriceUnavailableError } from "@/core/domain/errors";
import { normalizeListPrice, type PriceReading } from "@/core/domain/price";
import { summarizeVariants, type ProductVariant } from "@/core/domain/variants";
import { fetchJson } from "./http-client";
import type { PlatformReader } from "./platform";

interface ShopifyVariant {
  id: number;
  title: string;
  price: number;
  compare_at_price: number | null;
  available: boolean;
  featured_image: { src: string } | null;
}

interface ShopifyProduct {
  title: string;
  vendor?: string;
  featured_image: string | null;
  variants: ShopifyVariant[];
}

const PRODUCT_PATH = /\/products\/([^/?#]+)/;

/**
 * Tiendas Shopify (Revés Derecho, Orquídea, Modista, ...).
 * Usa el JSON público `/products/<handle>.js`, que entrega los precios en centavos.
 * Si la URL trae `?variant=`, se sigue solo ese color; si no, la línea completa con todos sus colores.
 */
export const shopifyReader: PlatformReader = {
  name: "shopify",

  matches: (url) => PRODUCT_PATH.test(url.pathname),

  async read(url) {
    const handle = PRODUCT_PATH.exec(url.pathname)![1];
    const product = await fetchJson<ShopifyProduct>(`${url.origin}/products/${handle}.js`);
    if (!Array.isArray(product?.variants) || product.variants.length === 0) {
      throw new PriceUnavailableError("unsupported", "No es un producto Shopify");
    }

    const variantId = url.searchParams.get("variant");
    const selected = variantId ? product.variants.find((v) => String(v.id) === variantId) : undefined;
    const currency = await shopCurrency(url.origin);

    if (!selected && product.variants.length > 1) {
      const variants = product.variants.map((v) => toVariant(v, url, handle));
      const summary = summarizeVariants(variants)!;
      return {
        name: product.title,
        brand: product.vendor || null,
        imageUrl: absoluteUrl(product.featured_image),
        ...summary,
        currency,
        variants,
      } satisfies PriceReading;
    }

    const variant = selected ?? product.variants[0];
    const price = variant.price / 100;
    const showVariant = selected && variant.title && variant.title !== "Default Title";
    return {
      name: showVariant ? `${product.title} – ${variant.title}` : product.title,
      brand: product.vendor || null,
      imageUrl: absoluteUrl(variant.featured_image?.src ?? product.featured_image),
      price,
      listPrice: normalizeListPrice(price, variant.compare_at_price != null ? variant.compare_at_price / 100 : null),
      currency,
      available: variant.available,
    } satisfies PriceReading;
  },
};

function toVariant(variant: ShopifyVariant, url: URL, handle: string): ProductVariant {
  const price = variant.price / 100;
  return {
    key: String(variant.id),
    name: variant.title,
    price,
    listPrice: normalizeListPrice(price, variant.compare_at_price != null ? variant.compare_at_price / 100 : null),
    available: variant.available,
    url: `${url.origin}/products/${handle}?variant=${variant.id}`,
    imageUrl: absoluteUrl(variant.featured_image?.src),
  };
}

const currencyCache = new Map<string, string>();

async function shopCurrency(origin: string): Promise<string> {
  const cached = currencyCache.get(origin);
  if (cached) return cached;
  try {
    const meta = await fetchJson<{ currency?: string }>(`${origin}/meta.json`);
    const currency = meta.currency ?? "CLP";
    currencyCache.set(origin, currency);
    return currency;
  } catch {
    return "CLP";
  }
}

function absoluteUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  return src.startsWith("//") ? `https:${src}` : src;
}
