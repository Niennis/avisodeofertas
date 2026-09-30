import { DomainError } from "./errors";

/** Parámetros que identifican una variante (color, tamaño) y deben conservarse. */
const KEPT_PARAMS = new Set(["variant", "default_sku", "id_product_attribute"]);

/**
 * Normaliza la URL de un producto para que dos enlaces al mismo producto
 * (con o sin parámetros de seguimiento, `www`, etc.) se consideren iguales.
 */
export function normalizeProductUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new DomainError("La dirección no es una URL válida.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new DomainError("La URL debe comenzar con http:// o https://");
  }
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (!KEPT_PARAMS.has(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

const STORE_NAMES: Record<string, string> = {
  "cruzverde.cl": "Cruz Verde",
  "farmaciasahumada.cl": "Farmacias Ahumada",
  "salcobrand.cl": "Salcobrand",
  "revesderecho.com": "Revés Derecho",
  "orquidea.cl": "Orquídea",
  "reginella.cl": "Reginella",
  "modista.cl": "Modista",
  "lanamovil.cl": "Lana Móvil",
  "conamoramor.cl": "Con Amor Amor",
};

export function storeNameFromUrl(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return STORE_NAMES[host] ?? host;
}

/** Compara dos enlaces de producto ignorando `www.`, parámetros de seguimiento y otras diferencias menores. */
export function sameProductUrl(a: string, b: string): boolean {
  const key = (url: string) => normalizeProductUrl(url).replace("://www.", "://");
  try {
    return key(a) === key(b);
  } catch {
    return false;
  }
}
