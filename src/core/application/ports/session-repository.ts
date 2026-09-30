import type { User } from "@/core/domain/user";

export interface SessionRepository {
  /** Crea una sesión y devuelve el token opaco que se guarda en la cookie. */
  create(userId: string, expiresAt: Date): Promise<string>;
  findUser(token: string, now: Date): Promise<User | null>;
  delete(token: string): Promise<void>;
}
