import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { PriceUnavailableError } from "@/core/domain/errors";

/**
 * Direcciones que no son de internet: la propia máquina, redes privadas, la de metadatos
 * de la nube, etc. La app pide las URLs que pegan las personas, así que sin este filtro
 * alguien podría usarla para llegar a servicios internos del servidor (SSRF).
 */
const PRIVATE_RANGES = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  PRIVATE_RANGES.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  PRIVATE_RANGES.addSubnet(address, prefix, "ipv6");
}

/** `true` si la IP es de internet (no local, privada ni reservada). */
export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return false;
  if (version === 6) {
    // IPv4 escrita como IPv6 (::ffff:127.0.0.1): se revisa la IPv4 que trae dentro.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
    if (mapped) return isPublicAddress(mapped);
    return !PRIVATE_RANGES.check(ip, "ipv6");
  }
  return !PRIVATE_RANGES.check(ip, "ipv4");
}

/** Falla si la URL no es http(s) o si su dominio apunta a alguna dirección que no es de internet. */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new PriceUnavailableError("unsupported", `Protocolo no permitido: ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  } catch {
    throw new PriceUnavailableError("unavailable", `${host} no se pudo resolver`);
  }
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
    throw new PriceUnavailableError("unsupported", `${host} no es una dirección pública`);
  }
}
