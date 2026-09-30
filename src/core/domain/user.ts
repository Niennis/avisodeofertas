export interface User {
  id: string;
  email: string;
  /** Si quiere recibir un email cuando haya ofertas. */
  emailNotifications: boolean;
  palette: Palette;
  createdAt: Date;
}

/** Paletas de colores disponibles para la interfaz. La primera es la predeterminada. */
export const PALETTES = ["sobria", "caramelo", "electrico", "jardin"] as const;
export type Palette = (typeof PALETTES)[number];
export const DEFAULT_PALETTE: Palette = "sobria";

export function isPalette(value: unknown): value is Palette {
  return PALETTES.includes(value as Palette);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
