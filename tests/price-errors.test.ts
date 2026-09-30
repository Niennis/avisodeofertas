import { afterEach, describe, expect, it, vi } from "vitest";
import { problemFromStatus } from "@/adapters/price-readers/http-client";
import { MultiPlatformPriceReader } from "@/adapters/price-readers/multi-platform-price-reader";
import { PriceUnavailableError } from "@/core/domain/errors";

/** Simula la respuesta de la tienda sin salir a internet. */
function stubFetch(respond: () => Promise<Response> | Response) {
  vi.stubGlobal("fetch", vi.fn(async () => respond()));
}

async function readError(url: string): Promise<PriceUnavailableError> {
  try {
    await new MultiPlatformPriceReader().read(url);
  } catch (error) {
    if (error instanceof PriceUnavailableError) return error;
    throw error;
  }
  throw new Error("Se esperaba un error");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mensajes cuando no se puede leer el precio", () => {
  it.each([
    [403, "blocked"],
    [429, "blocked"],
    [404, "not_found"],
    [503, "unavailable"],
    [400, "unsupported"],
  ] as const)("estado %i → %s", (status, problem) => {
    expect(problemFromStatus(status)).toBe(problem);
  });

  it("página sin precio: tienda no compatible, con el detalle técnico aparte", async () => {
    stubFetch(() => new Response("<html><h1>Hola</h1></html>", { headers: { "content-type": "text/html" } }));
    const error = await readError("https://tienda-nueva.cl/algo");
    expect(error.problem).toBe("unsupported");
    expect(error.message).toBe("Todavía no sabemos leer el precio de esta tienda.");
    expect(error.detail).toContain("no tiene un precio reconocible");
  });

  it("verificación anti-bots: bloqueo, aunque responda 503", async () => {
    stubFetch(() => new Response("<title>Just a moment...</title><div id=cf-chl-widget>", { status: 503 }));
    const error = await readError("https://tienda-nueva.cl/algo");
    expect(error.problem).toBe("blocked");
    expect(error.message).toBe("La tienda está bloqueando la consulta automática.");
  });

  it("un 404 con reCAPTCHA en la página sigue siendo 'no existe'", async () => {
    stubFetch(() => new Response('<script src="https://www.google.com/recaptcha/api.js"></script>', { status: 404 }));
    expect((await readError("https://tienda-nueva.cl/algo")).problem).toBe("not_found");
  });

  it("sin respuesta: la tienda no respondió", async () => {
    stubFetch(() => Promise.reject(Object.assign(new Error("timeout"), { name: "TimeoutError" })));
    const error = await readError("https://tienda-nueva.cl/algo");
    expect(error.problem).toBe("unavailable");
    expect(error.message).toBe("La tienda no respondió bien. Intenta de nuevo en un rato; si sigue igual, revisa el enlace.");
  });

  it("si la API de la plataforma falla pero la página se lee, no hay error", async () => {
    stubFetch(() =>
      new Response('<meta property="product:price:amount" content="4990"><meta property="og:title" content="Lana">', {
        headers: { "content-type": "text/html" },
      }),
    );
    // /products/... prueba primero Shopify (recibe HTML en vez de JSON) y luego lee el HTML.
    await expect(new MultiPlatformPriceReader().read("https://tienda.cl/products/lana")).resolves.toMatchObject({
      name: "Lana",
      price: 4990,
    });
  });
});
