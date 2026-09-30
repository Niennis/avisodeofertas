import type { Watch, WatchSettings, WatchWithProduct } from "@/core/domain/watch";

export interface WatchRecipient {
  watch: Watch;
  email: string;
  emailNotifications: boolean;
}

export interface WatchRepository {
  listByUser(userId: string): Promise<WatchWithProduct[]>;
  findForUser(userId: string, watchId: string): Promise<WatchWithProduct | null>;
  create(userId: string, productId: string, settings: WatchSettings): Promise<Watch>;
  updateSettings(watchId: string, settings: WatchSettings): Promise<void>;
  updateLastNotified(watchId: string, price: number | null, at: Date | null): Promise<void>;
  /** Desde cuándo contar los regresos de stock para este seguimiento. */
  markRestockNotified(watchId: string, at: Date): Promise<void>;
  setExcludedVariants(watchId: string, keys: string[]): Promise<void>;
  setGroup(watchIds: string[], groupId: string | null): Promise<void>;
  delete(watchId: string): Promise<void>;
  /** Seguimientos de un producto junto al email de su dueño y su preferencia de avisos. */
  listRecipients(productId: string): Promise<WatchRecipient[]>;
}
