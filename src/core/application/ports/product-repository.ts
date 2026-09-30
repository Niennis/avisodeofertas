import type { PriceReading } from "@/core/domain/price";
import type { PriceInsight } from "@/core/domain/price-insight";
import type { PriceSnapshot, Product } from "@/core/domain/product";

export interface NewProduct {
  url: string;
  store: string;
  reading: PriceReading;
  checkedAt: Date;
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findByUrl(url: string): Promise<Product | null>;
  /** Crea el producto y registra la primera lectura en el historial. */
  create(input: NewProduct): Promise<Product>;
  /** Actualiza el precio actual y agrega la lectura al historial. */
  recordReading(productId: string, reading: PriceReading, checkedAt: Date): Promise<void>;
  savePriceInsight(productId: string, insight: PriceInsight | null): Promise<void>;
  /** Guarda el error y devuelve cuántas revisiones seguidas lleva fallando. */
  recordError(productId: string, error: string, checkedAt: Date): Promise<number>;
  /** Productos que al menos un usuario sigue. */
  listWatched(): Promise<Product[]>;
  history(productId: string, since: Date): Promise<PriceSnapshot[]>;
  /** Elimina productos que ya nadie sigue. */
  deleteOrphans(): Promise<number>;
}
