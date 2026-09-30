import { isOnSale } from "./price";
import type { PriceSummary } from "./variants";
import { watchSummary, type WatchWithProduct } from "./watch";

/** Grupo de "mismo producto" en varias tiendas, creado por el usuario. */
export interface ProductGroup {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
}

export interface GroupWithMembers extends ProductGroup {
  members: WatchWithProduct[];
}

/** Un grupo necesita al menos dos tiendas; con menos se deshace. */
export const MIN_GROUP_SIZE = 2;

export interface GroupBest {
  watch: WatchWithProduct;
  summary: PriceSummary;
}

/**
 * La mejor opción del grupo, con la misma regla que en una línea de colores:
 * si alguna tienda tiene rebaja, la rebajada más barata; si no, la más barata.
 * Las agotadas solo cuentan si lo están todas.
 */
export function groupBest(members: WatchWithProduct[]): GroupBest | null {
  const options = members
    .map((watch) => ({ watch, summary: watchSummary(watch) }))
    .filter((o): o is GroupBest => o.summary != null);
  if (options.length === 0) return null;
  const inStock = options.filter((o) => o.summary.available !== false);
  const candidates = inStock.length > 0 ? inStock : options;
  const onSale = candidates.filter((o) => isOnSale(o.summary.price, o.summary.listPrice));
  const pool = onSale.length > 0 ? onSale : candidates;
  return pool.reduce((a, b) => (b.summary.price < a.summary.price ? b : a));
}

/** Miembros ordenados del más barato al más caro (los sin precio al final). */
export function sortMembersByPrice(members: WatchWithProduct[]): WatchWithProduct[] {
  return [...members].sort((a, b) => (watchSummary(a)?.price ?? Infinity) - (watchSummary(b)?.price ?? Infinity));
}
