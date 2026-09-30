import { DomainError } from "@/core/domain/errors";
import { isPalette } from "@/core/domain/user";
import type { UserRepository } from "../ports/user-repository";

/** Preferencias de la cuenta del usuario. */
export class AccountService {
  constructor(private readonly users: UserRepository) {}

  setEmailNotifications(userId: string, enabled: boolean): Promise<void> {
    return this.users.setEmailNotifications(userId, enabled);
  }

  async setPalette(userId: string, palette: string): Promise<void> {
    if (!isPalette(palette)) throw new DomainError("Esa paleta no existe.");
    await this.users.setPalette(userId, palette);
  }
}
