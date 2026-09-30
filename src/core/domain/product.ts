import type { PriceInsight } from "./price-insight";
import type { RestockTimes } from "./restock";
import type { ProductVariant } from "./variants";

/** Producto (o línea con varios colores) seguido por uno o más usuarios. Se identifica por su URL normalizada. */
export interface Product {
  id: string;
  url: string;
  store: string;
  name: string;
  /** Marca, cuando la tienda la informa. */
  brand: string | null;
  imageUrl: string | null;
  currency: string;
  price: number | null;
  listPrice: number | null;
  available: boolean | null;
  /** Colores o variantes de la línea; vacío si es un producto simple. */
  variants: ProductVariant[];
  /** Análisis del historial de precio; `null` hasta la primera lectura con el análisis. */
  priceInsight: PriceInsight | null;
  /** Cuándo volvió a haber stock de cada opción. */
  restocks: RestockTimes;
  lastCheckedAt: Date | null;
  lastError: string | null;
  /** Revisiones seguidas que fallaron (se reinicia al leer el precio). */
  consecutiveFailures: number;
  createdAt: Date;
}

export interface PriceSnapshot {
  price: number;
  listPrice: number | null;
  available: boolean | null;
  checkedAt: Date;
}
