import type { ProductGroup } from "@/core/domain/group";

export interface GroupRepository {
  create(userId: string, name: string): Promise<ProductGroup>;
  findForUser(userId: string, groupId: string): Promise<ProductGroup | null>;
  listByUser(userId: string): Promise<ProductGroup[]>;
  rename(groupId: string, name: string): Promise<void>;
  /** Elimina el grupo; sus seguimientos quedan sueltos. */
  delete(groupId: string): Promise<void>;
}
