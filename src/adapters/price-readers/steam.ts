import { PriceUnavailableError } from "@/core/domain/errors";
import { normalizeListPrice, type PriceReading } from "@/core/domain/price";
import { fetchJson } from "./http-client";
import type { PlatformReader } from "./platform";

interface SteamAppDetails {
  [appId: string]: {
    success: boolean;
    data?: {
      name: string;
      is_free: boolean;
      header_image?: string;
      publishers?: string[];
      price_overview?: { currency: string; initial: number; final: number };
    };
  };
}

const APP_PATH = /^\/app\/(\d+)/;

/**
 * Steam. La página del juego puede pedir la edad antes de mostrarse, así que
 * los precios se leen de la API pública `appdetails`, en pesos chilenos (`cc=cl`).
 * Los precios vienen en centavos.
 */
export const steamReader: PlatformReader = {
  name: "steam",

  matches: (url) => url.hostname === "store.steampowered.com" && APP_PATH.test(url.pathname),

  async read(url) {
    const appId = APP_PATH.exec(url.pathname)![1];
    const response = await fetchJson<SteamAppDetails>(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=cl&l=spanish&filters=basic,price_overview`,
    );
    const app = response?.[appId];
    if (!app?.success || !app.data) {
      throw new PriceUnavailableError("not_found", `Steam no tiene la app ${appId}`);
    }

    const { data } = app;
    const prices = data.price_overview;
    if (!prices) {
      throw new PriceUnavailableError(
        "unsupported",
        `Steam no informó precio para la app ${appId}`,
        data.is_free
          ? "Este juego es gratis en Steam, así que no tiene precio que seguir."
          : "Steam no muestra un precio para este juego (puede que aún no esté a la venta).",
      );
    }

    const price = prices.final / 100;
    return {
      name: data.name,
      brand: data.publishers?.[0] || null,
      imageUrl: data.header_image ?? null,
      price,
      listPrice: normalizeListPrice(price, prices.initial / 100),
      currency: prices.currency,
      available: true,
    } satisfies PriceReading;
  },
};
