import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import {
  ahumadaExtractor,
  prestaShopExtractor,
  salcobrandExtractor,
  structuredDataExtractor,
} from "@/adapters/price-readers/html/extractors";
import { parsePrice } from "@/adapters/price-readers/parse-price";

// Fragmentos basados en el HTML real de cada tienda (septiembre 2026).

describe("parsePrice", () => {
  it.each([
    ["$1.470", 1470],
    ["$ 28.999", 28999],
    ["2152.0", 2152],
    ["1049.999985", 1049.999985],
    ["1.049,99", 1049.99],
    ["1,049.99", 1049.99],
    ["$1.234.567", 1234567],
    ["gratis", null],
  ])("%s → %s", (text, expected) => {
    expect(parsePrice(text)).toBe(expected);
  });
});

describe("Farmacias Ahumada", () => {
  const url = new URL("https://www.farmaciasahumada.cl/protector-solar-95998.html");

  it("lee precio rebajado y precio normal del producto principal", () => {
    const $ = cheerio.load(`
      <div class="product-detail">
        <h1 class="product-name">Protector Solar FPS 50</h1>
        <div class="prices"><div class="price">
          <span class="sales"><span class="value" content="5124"></span>$5.124</span>
          <del><span class="strike-through list"><span class="value" content="10249">$10.249</span> Precio normal</span></del>
        </div></div>
      </div>
      <div class="recommendations"><div class="prices"><span class="sales"><span class="value" content="999"></span></span></div></div>`);
    expect(ahumadaExtractor.extract($, url)).toMatchObject({
      name: "Protector Solar FPS 50",
      price: 5124,
      listPrice: 10249,
    });
  });

  it("sin rebaja no informa precio de lista", () => {
    const $ = cheerio.load(`<div class="product-detail"><h1 class="product-name">Bálsamo</h1>
      <div class="prices"><span class="sales"><span class="value" content="28999"></span></span></div></div>`);
    expect(ahumadaExtractor.extract($, url)).toMatchObject({ price: 28999, listPrice: null });
  });
});

describe("Salcobrand", () => {
  it("toma el precio internet como vigente y el precio farmacia como normal", () => {
    const $ = cheerio.load(`
      <script type="application/ld+json">{"@graph":[{"@type":"Product","name":"Nenitos Pack Toallitas","offers":{"price":2199,"priceCurrency":"CLP","availability":"https://schema.org/InStock"}}]}</script>
      <div id="product-price"><div class="price">
        <div class="normal"><span class="display-price">$2.599</span><span>Precio Farmacia</span></div>
        <div class="offer-price"><span class="display-price">$2.199</span><span>Precio Internet</span></div>
      </div></div>`);
    expect(salcobrandExtractor.extract($, new URL("https://salcobrand.cl/products/nenitos"))).toMatchObject({
      name: "Nenitos Pack Toallitas",
      price: 2199,
      listPrice: 2599,
      available: true,
    });
  });
});

describe("PrestaShop (Reginella)", () => {
  it("lee el precio actual y el regular", () => {
    const $ = cheerio.load(`
      <meta property="og:title" content="Alaska Perla">
      <div class="product-prices js-product-prices"><div class="has-discount">
        <span class="current-price"><span class="product-price current-price-value" content="1249"> $1.249 </span></span>
        <span class="product-discount"><span class="regular-price">$1.470</span></span>
      </div></div>`);
    expect(prestaShopExtractor.extract($, new URL("https://www.reginella.cl/alaska/684-alaska-perla.html"))).toMatchObject({
      name: "Alaska Perla",
      price: 1249,
      listPrice: 1470,
    });
  });
});

describe("datos estructurados genéricos (Jumpseller y otras)", () => {
  const url = new URL("https://www.conamoramor.cl/allegro");

  it("usa product:original_price de Jumpseller como precio normal", () => {
    const $ = cheerio.load(`
      <meta property="og:title" content="Allegro">
      <meta property="product:original_price:amount" content="2690.0"/>
      <meta property="product:original_price:currency" content="CLP"/>
      <meta property="product:price:amount" content="2152.0"/>
      <meta property="product:price:currency" content="CLP"/>`);
    expect(structuredDataExtractor.extract($, url)).toMatchObject({
      name: "Allegro",
      price: 2152,
      listPrice: 2690,
      currency: "CLP",
    });
  });

  it("lee JSON-LD con varias ofertas y precio tachado", () => {
    const $ = cheerio.load(`<script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Product","name":"Merino","brand":{"@type":"Brand","name":"Drops"},"image":["https://x.cl/a.jpg"],
       "offers":[{"@type":"Offer","price":"3990","priceCurrency":"CLP","availability":"https://schema.org/InStock",
                  "priceSpecification":{"@type":"UnitPriceSpecification","priceType":"https://schema.org/StrikethroughPrice","price":4990}},
                 {"@type":"Offer","price":"4200","priceCurrency":"CLP"}]}
    </script>`);
    expect(structuredDataExtractor.extract($, url)).toEqual({
      name: "Merino",
      brand: "Drops",
      imageUrl: "https://x.cl/a.jpg",
      price: 3990,
      listPrice: 4990,
      currency: "CLP",
      available: true,
    });
  });

  it("devuelve null si la página no tiene precio", () => {
    expect(structuredDataExtractor.extract(cheerio.load("<h1>Hola</h1>"), url)).toBeNull();
  });
});
