import { describe, expect, it } from "vitest";
import { safeNextPath, sharedLink } from "@/web/shared-link";

describe("enlace compartido desde el celular", () => {
  it("lo toma de url, o lo busca dentro del texto o el título", () => {
    expect(sharedLink({ url: "https://www.orquidea.cl/products/merino" })).toBe("https://www.orquidea.cl/products/merino");
    expect(sharedLink({ text: "Mira esta lana https://revesderecho.cl/products/alpaca?variant=1 😍" })).toBe(
      "https://revesderecho.cl/products/alpaca?variant=1",
    );
    expect(sharedLink({ title: "Lana Merino", text: "https://lanamovil.cl/producto/bamboo/." })).toBe(
      "https://lanamovil.cl/producto/bamboo/",
    );
  });

  it("devuelve null si no llegó ningún enlace", () => {
    expect(sharedLink({})).toBeNull();
    expect(sharedLink({ text: "sin enlace", q: "https://no-es-compartido.cl" })).toBeNull();
  });
});

describe("página a la que volver después de ingresar", () => {
  it("acepta solo rutas internas", () => {
    expect(safeNextPath("/?url=https%3A%2F%2Ftienda.cl")).toBe("/?url=https%3A%2F%2Ftienda.cl");
    expect(safeNextPath("https://otro-sitio.com")).toBeNull();
    expect(safeNextPath("//otro-sitio.com")).toBeNull();
    expect(safeNextPath("/\\otro-sitio.com")).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});
