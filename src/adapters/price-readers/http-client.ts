import { PriceUnavailableError, type PriceProblem } from "@/core/domain/errors";
import { assertPublicUrl } from "./public-address";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const TIMEOUT_MS = 20_000;

export class HttpError extends PriceUnavailableError {
  constructor(
    readonly status: number,
    url: string,
    problem: PriceProblem = problemFromStatus(status),
  ) {
    super(problem, `${new URL(url).hostname} respondió con estado ${status}`);
  }
}

/** Traduce el estado HTTP al tipo de problema que se le muestra a la persona. */
export function problemFromStatus(status: number): PriceProblem {
  if (status === 401 || status === 403 || status === 429) return "blocked";
  if (status === 404 || status === 410) return "not_found";
  if (status >= 500) return "unavailable";
  return "unsupported";
}

/** Páginas de verificación anti-bots (Cloudflare y similares). */
const CHALLENGE_PAGE = /cf-chl|challenge-platform|Just a moment\.\.\.|Attention Required|captcha/i;

const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Pide la URL siguiendo las redirecciones a mano: así se revisa cada destino con `assertPublicUrl`
 * (una tienda, o alguien que se haga pasar por una, podría redirigir a una dirección interna).
 */
async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let current = new URL(url);
  let currentInit = init;
  let response: Response;
  for (let redirects = 0; ; redirects++) {
    await assertPublicUrl(current);
    try {
      response = await fetch(current, {
        ...currentInit,
        redirect: "manual",
        signal,
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "es-CL,es;q=0.9",
          ...currentInit.headers,
        },
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "no respondió a tiempo" : "no se pudo contactar";
      throw new PriceUnavailableError("unavailable", `${current.hostname} ${reason}`);
    }
    const location = response.headers.get("location");
    if (!REDIRECT_STATUSES.has(response.status) || !location) break;
    if (redirects >= MAX_REDIRECTS) {
      throw new PriceUnavailableError("unavailable", `${current.hostname} redirige demasiadas veces`);
    }
    await response.body?.cancel();
    current = new URL(location, current);
    // Igual que los navegadores: tras un 303 (o un 301/302 de un POST) se sigue con GET y sin cuerpo.
    const method = (currentInit.method ?? "GET").toUpperCase();
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
      currentInit = { ...currentInit, method: "GET", body: undefined };
    }
  }
  if (!response.ok) {
    // Una verificación anti-bots responde 403 o 503: si es eso, es un bloqueo, no una caída.
    // (Solo en esos estados: muchas tiendas cargan reCAPTCHA en todas sus páginas, incluso en la de error 404).
    const isChallenge =
      (response.status === 403 || response.status === 503) &&
      CHALLENGE_PAGE.test((await response.text().catch(() => "")).slice(0, 20_000));
    throw new HttpError(response.status, url, isChallenge ? "blocked" : undefined);
  }
  return response;
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await request(url, { ...init, headers: { Accept: "application/json", ...init.headers } });
  try {
    return (await response.json()) as T;
  } catch {
    throw new PriceUnavailableError("unsupported", `La respuesta de ${new URL(url).hostname} no es JSON`);
  }
}

/** Descarga HTML respetando el charset declarado (algunas tiendas no usan UTF-8). */
export async function fetchHtml(url: string): Promise<string> {
  const response = await request(url, { headers: { Accept: "text/html,application/xhtml+xml" } });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const charset =
    /charset=([\w-]+)/i.exec(response.headers.get("content-type") ?? "")?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(new TextDecoder("latin1").decode(bytes.subarray(0, 4096)))?.[1] ??
    "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export async function fetchWithResponse(url: string, init: RequestInit = {}): Promise<Response> {
  return request(url, init);
}
