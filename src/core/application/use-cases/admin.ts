import { groupFailuresByStore, type StoreFailures } from "@/core/domain/failures";
import { normalizeEmail, type User } from "@/core/domain/user";
import type { FailureRepository } from "../ports/failure-repository";

/** Funciones para quien administra la app: revisar qué tiendas no se pudieron leer. */
export class AdminService {
  constructor(
    private readonly failures: FailureRepository,
    private readonly adminEmail: string | null,
  ) {}

  isAdmin(user: Pick<User, "email">): boolean {
    return this.adminEmail != null && normalizeEmail(user.email) === normalizeEmail(this.adminEmail);
  }

  async failuresByStore(): Promise<StoreFailures[]> {
    return groupFailuresByStore(await this.failures.listAll());
  }

  /** "Ya lo resolví": limpia los fallos de esa tienda. */
  resolveStore(host: string): Promise<void> {
    return this.failures.deleteByHost(host);
  }
}
