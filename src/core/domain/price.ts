import type { ProductVariant } from "./variants";

/**
 * Lectura del precio de un producto en un momento dado, tal como lo publica la tienda.
 * `listPrice` es el precio "normal" o tachado; solo se informa cuando es mayor que `price`.
 * En una línea con varios colores, `variants` trae cada uno y el resto de los campos resume la línea.
 */
export interface PriceReading {
  name: string;
  brand?: string | null;
  imageUrl: string | null;
  price: number;
  listPrice: number | null;
  currency: string;
  /** `null` cuando la tienda no informa stock de forma confiable. */
  available: boolean | null;
  variants?: ProductVariant[];
}

/**
 * Normaliza precio actual y precio de lista: descarta un precio de lista
 * que no sea mayor que el actual (algunas tiendas lo publican igual o menor).
 */
export function normalizeListPrice(price: number, listPrice: number | null | undefined): number | null {
  if (listPrice == null || !Number.isFinite(listPrice)) return null;
  return listPrice > price ? listPrice : null;
}

export function isOnSale(price: number, listPrice: number | null): boolean {
  return listPrice != null && listPrice > price;
}

export function discountPercent(price: number, listPrice: number | null): number | null {
  if (!isOnSale(price, listPrice)) return null;
  return Math.round((1 - price / listPrice!) * 100);
}

export function isValidPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
