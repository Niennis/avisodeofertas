/**
 * Convierte textos de precio como "$1.470", "1.049,99", "2152.0" o "$ 28.999" en número.
 * Si hay separador de miles y decimales, el último que aparece es el decimal.
 * Con un solo tipo de separador seguido de grupos de exactamente 3 dígitos, se asume miles.
 */
export function parsePrice(text: string | number | null | undefined): number | null {
  if (text == null) return null;
  if (typeof text === "number") return Number.isFinite(text) ? text : null;

  const cleaned = text.replace(/[^\d.,]/g, "");
  if (!/\d/.test(cleaned)) return null;

  let normalized: string;
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    normalized = cleaned.split(thousands).join("").replace(decimal, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? "." : ",";
    const parts = cleaned.split(separator);
    const isThousands = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    normalized = isThousands ? parts.join("") : parts.slice(0, -1).join("") + "." + parts.at(-1);
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}
