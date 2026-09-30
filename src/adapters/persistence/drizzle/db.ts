import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_FOLDER = "./drizzle";

/**
 * Crea la conexión según `DATABASE_URL`:
 * - `postgres://...` o `postgresql://...` → Neon (driver HTTP, ideal para serverless).
 * - `pglite:memory` o `pglite:<carpeta>` → Postgres embebido, para desarrollo local y tests
 *   sin cuenta de Neon. En este modo las migraciones se aplican automáticamente.
 */
export async function createDatabase(url: string): Promise<Database> {
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const location = url.slice("pglite:".length);
    const client = location === "memory" ? new PGlite() : new PGlite(location);
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    return db as unknown as Database;
  }

  const { drizzle } = await import("drizzle-orm/neon-http");
  return drizzle(url, { schema }) as unknown as Database;
}
