import { and, asc, eq } from "drizzle-orm";
import type { GroupRepository } from "@/core/application/ports/group-repository";
import type { ProductGroup } from "@/core/domain/group";
import type { Database } from "./db";
import { productGroups } from "./schema";

export class DrizzleGroupRepository implements GroupRepository {
  constructor(private readonly db: Database) {}

  async create(userId: string, name: string): Promise<ProductGroup> {
    const [row] = await this.db.insert(productGroups).values({ userId, name }).returning();
    return row;
  }

  async findForUser(userId: string, groupId: string): Promise<ProductGroup | null> {
    const [row] = await this.db
      .select()
      .from(productGroups)
      .where(and(eq(productGroups.id, groupId), eq(productGroups.userId, userId)));
    return row ?? null;
  }

  listByUser(userId: string): Promise<ProductGroup[]> {
    return this.db.select().from(productGroups).where(eq(productGroups.userId, userId)).orderBy(asc(productGroups.createdAt));
  }

  async rename(groupId: string, name: string): Promise<void> {
    await this.db.update(productGroups).set({ name }).where(eq(productGroups.id, groupId));
  }

  async delete(groupId: string): Promise<void> {
    await this.db.delete(productGroups).where(eq(productGroups.id, groupId));
  }
}
