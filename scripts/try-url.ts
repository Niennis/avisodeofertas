import { MultiPlatformPriceReader } from "../src/adapters/price-readers/multi-platform-price-reader";

/** Uso: pnpm try-url <url> [<url> ...]  — muestra lo que la app lee de cada producto. */
async function main() {
  const reader = new MultiPlatformPriceReader();
  for (const url of process.argv.slice(2)) {
    try {
      console.log(url, "\n ", await reader.read(url));
    } catch (error) {
      console.log(url, "\n  ERROR:", error instanceof Error ? error.message : error);
    }
  }
}

main();
