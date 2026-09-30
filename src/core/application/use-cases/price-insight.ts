import { analyzePriceHistory, type PriceInsight } from "@/core/domain/price-insight";
import type { ProductRepository } from "../ports/product-repository";

/** Historial que se mira: 90 días para el mínimo, más margen para saber cuándo empezó una rebaja larga. */
const HISTORY_FOR_INSIGHT_DAYS = 180;

/** Recalcula y guarda el análisis del historial de un producto (llamar después de registrar una lectura). */
export async function refreshPriceInsight(
  products: ProductRepository,
  productId: string,
  now: Date,
): Promise<PriceInsight | null> {
  const since = new Date(now.getTime() - HISTORY_FOR_INSIGHT_DAYS * 24 * 60 * 60 * 1000);
  const insight = analyzePriceHistory(await products.history(productId, since), now);
  await products.savePriceInsight(productId, insight);
  return insight;
}
