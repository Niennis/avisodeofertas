import type { AlertReason } from "@/core/domain/alert-policy";
import type { StoreFailures } from "@/core/domain/failures";
import type { PriceInsight } from "@/core/domain/price-insight";

export interface Deal {
  productId: string;
  name: string;
  store: string;
  url: string;
  imageUrl: string | null;
  currency: string;
  price: number;
  listPrice: number | null;
  targetPrice: number | null;
  reasons: AlertReason[];
  /** En una línea con varios colores: los colores que cumplen la condición (vacío en productos simples). */
  variants: string[];
  /** ¿La rebaja es real?, ¿es el precio más bajo? Solo en productos simples (en una línea el historial es de otro color). */
  insight: PriceInsight | null;
}

/** Envía avisos de ofertas (un aviso agrupa todas las de un usuario) y reportes para quien administra. */
export interface Notifier {
  sendDeals(to: string, deals: Deal[]): Promise<void>;
  sendFailureReport(to: string, stores: StoreFailures[]): Promise<void>;
  /** Enlace para crear una contraseña nueva; vence en `validMinutes`. */
  sendPasswordReset(to: string, link: string, validMinutes: number): Promise<void>;
}
