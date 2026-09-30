type SearchParams = Record<string, string | string[] | undefined>;

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

/**
 * Enlace que llegó desde el menú "Compartir" del celular (ver `share_target` en el manifiesto).
 * Según la app de origen, el enlace viene en `url` o dentro del texto ("Mira esto https://…").
 */
export function sharedLink(params: SearchParams): string | null {
  for (const key of ["url", "text", "title"]) {
    const value = params[key];
    const match = (Array.isArray(value) ? value.join(" ") : (value ?? "")).match(URL_PATTERN);
    // Algunas apps agregan puntuación pegada al final del enlace.
    if (match) return match[0].replace(/[.,;:!?)\]]+$/, "");
  }
  return null;
}

/** Solo rutas internas ("/algo"), para no redirigir a otro sitio después de ingresar. */
export function safeNextPath(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : null;
}
