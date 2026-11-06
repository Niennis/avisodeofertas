import { lt, sql } from "drizzle-orm";
import type { RateLimiter } from "@/core/application/ports/rate-limiter";
import type { Database } from "./db";
import { rateLimits } from "./schema";

/**
 * Límite de pedidos guardado en Postgres: en Vercel cada request puede caer en una instancia
 * distinta, así que la cuenta no puede vivir en memoria. Un solo `upsert` suma o reinicia la
 * ventana, así que dos pedidos al mismo tiempo no se pisan.
 */
export class DrizzleRateLimiter implements RateLimiter {
  constructor(private readonly db: Database) {}

  async hit(key: string, limit: number, windowMs: number, now: Date): Promise<boolean> {
    const windowStart = new Date(now.getTime() - windowMs);
    const expired = sql`${rateLimits.windowStart} <= ${windowStart.toISOString()}`;
    const [row] = await this.db
      .insert(rateLimits)
      .values({ key, windowStart: now, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimits.count} + 1 END`,
          windowStart: sql`CASE WHEN ${expired} THEN ${now.toISOString()}::timestamptz ELSE ${rateLimits.windowStart} END`,
        },
      })
      .returning({ count: rateLimits.count });
    return (row?.count ?? 1) <= limit;
  }

  async prune(before: Date): Promise<void> {
    await this.db.delete(rateLimits).where(lt(rateLimits.windowStart, before));
  }
}
