import type { Palette, User } from "@/core/domain/user";

export interface UserWithPassword extends User {
  passwordHash: string;
  /** Intentos fallidos seguidos desde el último ingreso correcto. */
  failedLogins: number;
  /** Hasta cuándo no se puede ingresar por demasiados intentos fallidos. */
  lockedUntil: Date | null;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
  create(email: string, passwordHash: string): Promise<User>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  setEmailNotifications(userId: string, enabled: boolean): Promise<void>;
  setPalette(userId: string, palette: Palette): Promise<void>;
  /** Suma un intento fallido y devuelve cuántos lleva seguidos. */
  incrementFailedLogins(userId: string): Promise<number>;
  /** Bloquea el ingreso hasta esa fecha y reinicia el contador. */
  lockLogin(userId: string, until: Date): Promise<void>;
  clearFailedLogins(userId: string): Promise<void>;
  /** Cuenta de demostración: sin contraseña, sin emails y con fecha de borrado. */
  createDemo(input: { email: string; expiresAt: Date; watchLimit: number }): Promise<User>;
  /** Borra una cuenta demo (nunca una normal), con sus productos, grupos y sesiones. */
  deleteDemo(userId: string): Promise<void>;
  /** Borra las cuentas demo vencidas; devuelve cuántas. */
  deleteExpiredDemos(now: Date): Promise<number>;
}
