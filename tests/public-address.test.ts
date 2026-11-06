import { lookup } from "node:dns/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHtml } from "@/adapters/price-readers/http-client";
import { assertPublicUrl, isPublicAddress } from "@/adapters/price-readers/public-address";
import { PriceUnavailableError } from "@/core/domain/errors";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

/** Simula que el DNS de cualquier dominio responde esa IP. */
function resolveTo(address: string) {
  vi.mocked(lookup).mockResolvedValue([{ address, family: address.includes(":") ? 6 : 4 }] as never);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(lookup).mockReset();
});

describe("solo se piden direcciones de internet", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "%s no es pública",
    (ip) => {
      expect(isPublicAddress(ip)).toBe(false);
    },
  );

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700::1111", "::ffff:8.8.8.8"])("%s es pública", (ip) => {
    expect(isPublicAddress(ip)).toBe(true);
  });

  it("rechaza IPs internas escritas en la URL, sin consultar el DNS", async () => {
    await expect(assertPublicUrl(new URL("http://127.0.0.1:3000/admin"))).rejects.toBeInstanceOf(PriceUnavailableError);
    await expect(assertPublicUrl(new URL("http://[::1]/"))).rejects.toBeInstanceOf(PriceUnavailableError);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rechaza dominios que apuntan a una red interna", async () => {
    resolveTo("10.0.0.5");
    await expect(assertPublicUrl(new URL("https://interno.ejemplo.cl/"))).rejects.toMatchObject({ problem: "unsupported" });
  });

  it("no sigue una redirección hacia una dirección interna", async () => {
    resolveTo("93.184.216.34");
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchHtml("https://tienda.cl/products/lana")).rejects.toMatchObject({ problem: "unsupported" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sigue las redirecciones normales entre páginas públicas", async () => {
    resolveTo("93.184.216.34");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/products/lana-nueva" } }))
      .mockResolvedValueOnce(new Response("<p>ok</p>", { headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchHtml("https://tienda.cl/products/lana")).resolves.toBe("<p>ok</p>");
    expect(String(fetchMock.mock.calls[1][0])).toBe("https://tienda.cl/products/lana-nueva");
  });
});
