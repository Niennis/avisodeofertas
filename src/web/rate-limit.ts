import "server-only";
import { headers } from "next/headers";
import { DomainError } from "@/core/domain/errors";
import { getContainer } from "@/composition/container";

const MINUTE = 60 * 1000;

/**
 * Pedidos por IP. Alcanzan de sobra para una persona (incluso equivocándose varias veces),
 * pero frenan a un bot que prueba contraseñas, códigos de invitación o envía emails en masa.
 */
export const RATE_LIMITS = {
  registro: { limit: 10, windowMs: 60 * MINUTE },
  ingreso: { limit: 20, windowMs: 15 * MINUTE },
  recuperar: { limit: 5, windowMs: 60 * MINUTE },
} as const;

export type LimitedAction = keyof typeof RATE_LIMITS;

/** La ventana más larga: las cuentas más antiguas que esto ya no sirven y se pueden borrar. */
export const LONGEST_WINDOW_MS = Math.max(...Object.values(RATE_LIMITS).map((r) => r.windowMs));

/**
 * IP de quien hace la request. En Vercel, `x-real-ip` lo pone la plataforma (no el navegador),
 * así que no se puede falsificar; fuera de Vercel se usa el primer valor de `x-forwarded-for`.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
}

/** Falla con un mensaje amable si esta IP superó el límite de la acción. */
export async function enforceRateLimit(action: LimitedAction): Promise<void> {
  const { rateLimiter, clock } = await getContainer();
  const { limit, windowMs } = RATE_LIMITS[action];
  const allowed = await rateLimiter.hit(`${action}:${await clientIp()}`, limit, windowMs, clock.now());
  if (!allowed) {
    throw new DomainError("Hubo demasiados intentos desde esta conexión. Espera unos minutos e intenta de nuevo.");
  }
}
