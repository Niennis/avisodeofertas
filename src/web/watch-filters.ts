import { matchingOptions } from "@/core/domain/alert-policy";
import { discountPercent } from "@/core/domain/price";
import { includedVariants } from "@/core/domain/variants";
import { groupBest, type ProductGroup } from "@/core/domain/group";
import type { PriceSummary } from "@/core/domain/variants";
import { watchPriceOptions, watchSummary, type WatchWithProduct } from "@/core/domain/watch";

export const STATUS_OPTIONS = {
  todos: "Todos",
  oferta: "En oferta",
  "sin-oferta": "Sin oferta",
  problemas: "Con problemas",
} as const;

export const SORT_OPTIONS = {
  recientes: "Más recientes",
  descuento: "Mayor descuento",
  precio: "Menor precio",
  nombre: "Nombre",
} as const;

export type StatusFilter = keyof typeof STATUS_OPTIONS;
export type SortOrder = keyof typeof SORT_OPTIONS;

export interface WatchFilters {
  q: string;
  tienda: string | null;
  estado: StatusFilter;
  orden: SortOrder;
}

export const DEFAULT_FILTERS: WatchFilters = { q: "", tienda: null, estado: "todos", orden: "recientes" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(options: Record<T, string>, value: string | undefined, fallback: T): T {
  return value != null && value in options ? (value as T) : fallback;
}

/** Lee los filtros desde la URL (`?q=merino&tienda=Orquídea&estado=oferta&orden=precio`). */
export function parseFilters(params: SearchParams): WatchFilters {
  return {
    q: first(params.q)?.trim() ?? "",
    tienda: first(params.tienda) || null,
    estado: oneOf(STATUS_OPTIONS, first(params.estado), DEFAULT_FILTERS.estado),
    orden: oneOf(SORT_OPTIONS, first(params.orden), DEFAULT_FILTERS.orden),
  };
}

/** Solo incluye en la URL lo que difiere de los valores por defecto. */
export function filtersToQuery(filters: WatchFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.tienda) params.set("tienda", filters.tienda);
  if (filters.estado !== DEFAULT_FILTERS.estado) params.set("estado", filters.estado);
  if (filters.orden !== DEFAULT_FILTERS.orden) params.set("orden", filters.orden);
  return params.toString();
}

export function hasActiveFilters(filters: WatchFilters): boolean {
  return filtersToQuery(filters) !== "";
}

/** Una tarjeta de la lista: un producto suelto o un grupo de "mismo producto en varias tiendas". */
export type ListEntry =
  | { kind: "watch"; id: string; watch: WatchWithProduct }
  | { kind: "group"; id: string; group: ProductGroup; members: WatchWithProduct[] };

/** Arma las tarjetas: los seguimientos de un mismo grupo se juntan en una sola. */
export function toEntries(watches: WatchWithProduct[], groups: ProductGroup[]): ListEntry[] {
  const byGroup = new Map<string, WatchWithProduct[]>();
  const entries: ListEntry[] = [];
  for (const watch of watches) {
    if (watch.groupId && groups.some((g) => g.id === watch.groupId)) {
      byGroup.set(watch.groupId, [...(byGroup.get(watch.groupId) ?? []), watch]);
    } else {
      entries.push({ kind: "watch", id: watch.id, watch });
    }
  }
  for (const group of groups) {
    const members = byGroup.get(group.id);
    if (members?.length) entries.push({ kind: "group", id: group.id, group, members });
  }
  return entries;
}

export function entryWatches(entry: ListEntry): WatchWithProduct[] {
  return entry.kind === "watch" ? [entry.watch] : entry.members;
}

export function entryName(entry: ListEntry): string {
  return entry.kind === "watch" ? entry.watch.product.name : entry.group.name;
}

export function entrySummary(entry: ListEntry): PriceSummary | null {
  return entry.kind === "watch" ? watchSummary(entry.watch) : (groupBest(entry.members)?.summary ?? null);
}

/** El precio actual (o el de algún color incluido) cumple alguna de las condiciones de aviso del usuario. */
export function isWatchDeal(watch: WatchWithProduct): boolean {
  return matchingOptions(watch, watchPriceOptions(watch.product, watch.excludedVariants)).length > 0;
}

/** En un grupo, basta con que una tienda esté en oferta. */
export function isDeal(entry: ListEntry): boolean {
  return entryWatches(entry).some(isWatchDeal);
}

/** Minúsculas y sin tildes, para que "algodon" encuentre "Algodón". */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function matchesStatus(entry: ListEntry, status: StatusFilter): boolean {
  switch (status) {
    case "oferta":
      return isDeal(entry);
    case "sin-oferta":
      return !isDeal(entry);
    case "problemas":
      return entryWatches(entry).some((w) => w.product.lastError != null);
    default:
      return true;
  }
}

/** Todo el texto por el que se puede encontrar una tarjeta: nombres, marcas, tiendas y colores incluidos. */
function searchText(entry: ListEntry): string {
  const parts = entry.kind === "group" ? [entry.group.name] : [];
  for (const watch of entryWatches(entry)) {
    const colors = includedVariants(watch.product.variants, watch.excludedVariants).map((v) => v.name);
    parts.push(watch.product.name, watch.product.brand ?? "", watch.product.store, ...colors);
  }
  return normalizeText(parts.join(" "));
}

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

function discountOf(entry: ListEntry): number {
  const summary = entrySummary(entry);
  return summary ? (discountPercent(summary.price, summary.listPrice) ?? 0) : 0;
}

function createdAt(entry: ListEntry): number {
  return (entry.kind === "watch" ? entry.watch.createdAt : entry.group.createdAt).getTime();
}

const comparators: Record<SortOrder, (a: ListEntry, b: ListEntry) => number> = {
  recientes: (a, b) => createdAt(b) - createdAt(a),
  descuento: (a, b) => discountOf(b) - discountOf(a) || comparators.precio(a, b),
  precio: (a, b) => (entrySummary(a)?.price ?? Infinity) - (entrySummary(b)?.price ?? Infinity),
  nombre: (a, b) => collator.compare(entryName(a), entryName(b)),
};

/**
 * Filtra y ordena la lista. La búsqueda exige que cada palabra aparezca en el nombre, la marca,
 * la tienda o un color incluido ("merino orquidea" encuentra la merino de Orquídea).
 * En un grupo basta con que coincida cualquiera de sus tiendas.
 */
export function applyFilters(entries: ListEntry[], filters: WatchFilters): ListEntry[] {
  const words = normalizeText(filters.q).split(/\s+/).filter(Boolean);
  return entries
    .filter((entry) => {
      if (filters.tienda && !entryWatches(entry).some((w) => w.product.store === filters.tienda)) return false;
      if (!matchesStatus(entry, filters.estado)) return false;
      const haystack = searchText(entry);
      return words.every((word) => haystack.includes(word));
    })
    .sort(comparators[filters.orden]);
}

/** Tiendas presentes en la lista, con cuántos productos tiene cada una (contando los de los grupos). */
export function storeCounts(entries: ListEntry[]): { store: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const watch of entries.flatMap(entryWatches)) {
    counts.set(watch.product.store, (counts.get(watch.product.store) ?? 0) + 1);
  }
  return [...counts].map(([store, count]) => ({ store, count })).sort((a, b) => collator.compare(a.store, b.store));
}
