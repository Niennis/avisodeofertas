import "./load-env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { MIGRATIONS_FOLDER } from "../src/adapters/persistence/drizzle/db";

/** Aplica las migraciones pendientes en Neon. (Con `pglite:` se aplican solas al iniciar.) */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith("pglite:")) {
    console.log("DATABASE_URL no apunta a Neon; no hay nada que migrar.");
    return;
  }
  await migrate(drizzle(neon(url)), { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("Migraciones aplicadas.");
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
