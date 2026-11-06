export interface User {
  id: string;
  email: string;
  /** Si quiere recibir un email cuando haya ofertas. */
  emailNotifications: boolean;
  palette: Palette;
  createdAt: Date;
  /** Solo en las cuentas de demostración: cuándo se borra la cuenta. `null` en las cuentas normales. */
  demoExpiresAt: Date | null;
  /** Máximo de productos que puede seguir; `null` = sin límite (las cuentas demo tienen uno). */
  watchLimit: number | null;
}

/** Las cuentas demo no tienen contraseña ni email real: se crean con "Probar la demo" y duran un día. */
export function isDemo(user: Pick<User, "demoExpiresAt">): boolean {
  return user.demoExpiresAt != null;
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
