import type { PriceReading } from "@/core/domain/price";

/**
 * Obtiene el precio actual de un producto a partir de su URL.
 * Lanza `PriceUnavailableError` si la tienda no responde o no se reconoce el precio.
 */
export interface PriceReader {
  read(url: string): Promise<PriceReading>;
}
