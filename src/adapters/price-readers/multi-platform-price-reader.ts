import * as cheerio from "cheerio";
import { PriceUnavailableError } from "@/core/domain/errors";
import type { PriceReading } from "@/core/domain/price";
import type { PriceReader } from "@/core/application/ports/price-reader";
import { cruzVerdeReader } from "./cruz-verde";
import { htmlExtractors } from "./html/extractors";
import { prestaShopCategoryReader } from "./prestashop-category";
import { fetchHtml } from "./http-client";
import type { HtmlExtractor, PlatformReader } from "./platform";
import { shopifyReader } from "./shopify";
import { wooCommerceReader } from "./woocommerce";

/**
 * Adaptador del puerto `PriceReader` que soporta varias plataformas.
 *
 * 1. Prueba los lectores por API cuya URL coincide (Cruz Verde, Shopify, WooCommerce, categorías PrestaShop).
 * 2. Si ninguno funciona, descarga el HTML y prueba los extractores en orden.
 *
 * Para soportar una tienda nueva basta con agregar un `PlatformReader` o un `HtmlExtractor`.
 */
export class MultiPlatformPriceReader implements PriceReader {
  constructor(
    private readonly platforms: PlatformReader[] = [
      cruzVerdeReader,
      shopifyReader,
      wooCommerceReader,
      prestaShopCategoryReader,
    ],
    private readonly extractors: HtmlExtractor[] = htmlExtractors,
  ) {}

  async read(rawUrl: string): Promise<PriceReading> {
    const url = new URL(rawUrl);
    const attempts: string[] = [];

    for (const platform of this.platforms.filter((p) => p.matches(url))) {
      try {
        return await platform.read(url);
      } catch (error) {
        // Cruz Verde no entrega precios en el HTML: su error es el definitivo.
        if (platform === cruzVerdeReader) throw error;
        attempts.push(`${platform.name}: ${describe(error)}`);
      }
    }

    // Si ni siquiera se puede descargar la página, ese es el problema a informar (bloqueo, caída, 404).
    const $ = cheerio.load(await fetchHtml(url.toString()));
    for (const extractor of this.extractors) {
      const reading = extractor.extract($, url);
      if (reading) return reading;
    }
    throw new PriceUnavailableError("unsupported", ["La página no tiene un precio reconocible", ...attempts].join(" · "));
  }
}

function describe(error: unknown): string {
  if (error instanceof PriceUnavailableError) return error.detail ?? error.message;
  return error instanceof Error ? error.message : String(error);
}
