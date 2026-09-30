import type { CheerioAPI } from "cheerio";
import type { PriceReading } from "@/core/domain/price";

/** Lector de una plataforma que expone los precios por API (sin leer el HTML). */
export interface PlatformReader {
  readonly name: string;
  /** Decide solo con la URL, sin hacer requests, si vale la pena intentar esta plataforma. */
  matches(url: URL): boolean;
  read(url: URL): Promise<PriceReading>;
}

/** Extrae el precio desde el HTML de la página del producto. Devuelve `null` si no aplica. */
export interface HtmlExtractor {
  readonly name: string;
  extract($: CheerioAPI, url: URL): PriceReading | null;
}
