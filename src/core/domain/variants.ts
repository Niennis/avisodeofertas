import { isOnSale, normalizeListPrice } from "./price";

/**
 * Variante de una línea de producto (por ejemplo, un color de una lana).
 * `key` es el identificador estable que usa la tienda.
 */
export interface ProductVariant {
  key: string;
  name: string;
  price: number;
  listPrice: number | null;
  available: boolean | null;
  url: string | null;
  imageUrl: string | null;
}

export interface PriceSummary {
  price: number;
  listPrice: number | null;
  available: boolean | null;
}

/**
 * Resume una línea en un solo precio para mostrar y guardar en el historial:
 * si hay variantes rebajadas, la más barata de ellas; si no, la más barata en general.
 * Se ignoran las agotadas, salvo que lo estén todas.
 */
export function summarizeVariants(variants: ProductVariant[]): PriceSummary | null {
  if (variants.length === 0) return null;
  const inStock = variants.filter((v) => v.available !== false);
  const candidates = inStock.length > 0 ? inStock : variants;
  const onSale = candidates.filter((v) => isOnSale(v.price, v.listPrice));
  const pool = onSale.length > 0 ? onSale : candidates;
  const best = pool.reduce((a, b) => (b.price < a.price ? b : a));

  const availability = variants.map((v) => v.available);
  const available = availability.some((a) => a === true)
    ? true
    : availability.every((a) => a === false)
      ? false
      : null;
  return { price: best.price, listPrice: normalizeListPrice(best.price, best.listPrice), available };
}

/** Variantes que el usuario sigue (todas menos las que desmarcó). */
export function includedVariants(variants: ProductVariant[], excluded: readonly string[]): ProductVariant[] {
  if (excluded.length === 0) return variants;
  const skip = new Set(excluded);
  return variants.filter((v) => !skip.has(v.key));
}
