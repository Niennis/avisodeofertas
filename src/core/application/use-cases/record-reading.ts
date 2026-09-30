import type { PriceReading } from "@/core/domain/price";
import type { PriceInsight } from "@/core/domain/price-insight";
import type { Product } from "@/core/domain/product";
import { recordRestocks, type RestockTimes } from "@/core/domain/restock";
import type { ProductRepository } from "../ports/product-repository";
import { refreshPriceInsight } from "./price-insight";

/**
 * Guarda una lectura nueva de un producto que ya existía: precio e historial, regresos de stock
 * (comparando con el estado anterior) y el análisis del historial.
 */
export async function recordProductReading(
  products: ProductRepository,
  product: Product,
  reading: PriceReading,
  at: Date,
): Promise<{ insight: PriceInsight | null; restocks: RestockTimes }> {
  await products.recordReading(product.id, reading, at);
  const restocks = recordRestocks(
    product,
    { available: reading.available, variants: reading.variants ?? [] },
    product.restocks,
    at,
  );
  if (Object.keys(restocks).some((key) => restocks[key] !== product.restocks[key])) {
    await products.saveRestocks(product.id, restocks);
  }
  const insight = await refreshPriceInsight(products, product.id, at);
  return { insight, restocks };
}
