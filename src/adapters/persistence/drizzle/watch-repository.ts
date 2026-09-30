import { and, desc, eq, inArray } from "drizzle-orm";
import type { WatchRecipient, WatchRepository } from "@/core/application/ports/watch-repository";
import type { Watch, WatchSettings, WatchWithProduct } from "@/core/domain/watch";
import type { Database } from "./db";
import { products, users, watches } from "./schema";

export class DrizzleWatchRepository implements WatchRepository {
  constructor(private readonly db: Database) {}

  async listByUser(userId: string): Promise<WatchWithProduct[]> {
    const rows = await this.db
      .select({ watch: watches, product: products })
      .from(watches)
      .innerJoin(products, eq(products.id, watches.productId))
      .where(eq(watches.userId, userId))
      .orderBy(desc(watches.createdAt));
    return rows.map(({ watch, product }) => ({ ...watch, product }));
  }

  async findForUser(userId: string, watchId: string): Promise<WatchWithProduct | null> {
    const [row] = await this.db
      .select({ watch: watches, product: products })
      .from(watches)
      .innerJoin(products, eq(products.id, watches.productId))
      .where(and(eq(watches.id, watchId), eq(watches.userId, userId)));
    return row ? { ...row.watch, product: row.product } : null;
  }

  async create(userId: string, productId: string, settings: WatchSettings): Promise<Watch> {
    const [row] = await this.db.insert(watches).values({ userId, productId, ...settings }).returning();
    return row;
  }

  async updateSettings(watchId: string, settings: WatchSettings): Promise<void> {
    await this.db.update(watches).set(settings).where(eq(watches.id, watchId));
  }

  async updateLastNotified(watchId: string, price: number | null, at: Date | null): Promise<void> {
    await this.db
      .update(watches)
      .set({ lastNotifiedPrice: price, lastNotifiedAt: at })
      .where(eq(watches.id, watchId));
  }

  async markRestockNotified(watchId: string, at: Date): Promise<void> {
    await this.db.update(watches).set({ lastRestockNotifiedAt: at }).where(eq(watches.id, watchId));
  }

  async setExcludedVariants(watchId: string, keys: string[]): Promise<void> {
    await this.db.update(watches).set({ excludedVariants: keys }).where(eq(watches.id, watchId));
  }

  async setGroup(watchIds: string[], groupId: string | null): Promise<void> {
    if (watchIds.length === 0) return;
    await this.db.update(watches).set({ groupId }).where(inArray(watches.id, watchIds));
  }

  async delete(watchId: string): Promise<void> {
    await this.db.delete(watches).where(eq(watches.id, watchId));
  }

  async listRecipients(productId: string): Promise<WatchRecipient[]> {
    return this.db
      .select({ watch: watches, email: users.email, emailNotifications: users.emailNotifications })
      .from(watches)
      .innerJoin(users, eq(users.id, watches.userId))
      .where(eq(watches.productId, productId));
  }
}
