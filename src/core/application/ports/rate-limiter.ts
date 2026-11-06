/** Cuenta pedidos por clave (por ejemplo, "registro:<ip>") en ventanas de tiempo fijas. */
export interface RateLimiter {
  /**
   * Suma un pedido a la clave y dice si todavía está dentro del límite.
   * La cuenta vuelve a cero cuando pasa `windowMs` desde el primer pedido de la ventana.
   */
  hit(key: string, limit: number, windowMs: number, now: Date): Promise<boolean>;
  /** Borra las ventanas que empezaron antes de `before` (ya no sirven). */
  prune(before: Date): Promise<void>;
}
