export interface PasswordResetRepository {
  /** Crea un enlace nuevo (invalida los anteriores de esa persona) y devuelve el token opaco. */
  create(userId: string, expiresAt: Date, now: Date): Promise<string>;
  /** Cuándo se pidió el último enlace, para no enviar varios seguidos. */
  lastCreatedAt(userId: string): Promise<Date | null>;
  /** Si el token es válido y no venció, lo borra (junto a los demás de esa persona) y devuelve a quién pertenece. */
  consume(token: string, now: Date): Promise<string | null>;
}
