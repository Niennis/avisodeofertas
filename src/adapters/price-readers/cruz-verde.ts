import { PriceUnavailableError } from "@/core/domain/errors";
import { normalizeListPrice, type PriceReading } from "@/core/domain/price";
import { fetchJson, fetchWithResponse, HttpError } from "./http-client";
import type { PlatformReader } from "./platform";

const API = "https://api.cruzverde.cl";

interface CruzVerdeProduct {
  productData?: {
    name: string;
    brand?: string;
    price?: number;
    priceCurrency?: string;
    prices?: Record<string, number>;
    images?: { disBaseLink?: string; link?: string }[];
  };
}

/**
 * Cruz Verde es una aplicación Angular; los precios vienen de su API.
 * La URL del producto termina en `/<id>.html`. Si la API exige sesión,
 * se inicia una sesión de invitado y se reintenta.
 */
export const cruzVerdeReader: PlatformReader = {
  name: "cruz-verde",

  matches: (url) => url.hostname.endsWith("cruzverde.cl"),

  async read(url) {
    const id = /\/(\d+)\.html$/.exec(url.pathname)?.[1];
    if (!id) {
      throw new PriceUnavailableError(
        "not_found",
        "URL de Cruz Verde sin id de producto",
        "Ese enlace de Cruz Verde no es de un producto. Cópialo desde la página del producto (termina en un número y .html).",
      );
    }

    const detailUrl = `${API}/product-service/products/detail/${id}`;
    let data: CruzVerdeProduct;
    try {
      data = await fetchJson<CruzVerdeProduct>(detailUrl);
    } catch (error) {
      if (!(error instanceof HttpError) || ![401, 403].includes(error.status)) throw error;
      data = await fetchJson<CruzVerdeProduct>(detailUrl, { headers: { Cookie: await guestCookie() } });
    }

    const product = data.productData;
    const listPrice = product?.prices?.["price-list-cl"] ?? product?.price;
    const price = product?.prices?.["price-sale-cl"] ?? listPrice;
    if (!product || !price) throw new PriceUnavailableError("unsupported", "Cruz Verde no informó precio");

    return {
      name: product.name,
      brand: product.brand || null,
      imageUrl: product.images?.[0]?.disBaseLink ?? product.images?.[0]?.link ?? null,
      price,
      listPrice: normalizeListPrice(price, listPrice),
      currency: product.priceCurrency ?? "CLP",
      // El stock depende de la sucursal elegida, así que no se informa.
      available: null,
    } satisfies PriceReading;
  },
};

async function guestCookie(): Promise<string> {
  const response = await fetchWithResponse(`${API}/customer-service/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}
