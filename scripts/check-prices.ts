import "./load-env";
import { buildContainer } from "../src/composition/container";

/** Revisa todos los precios y envía los avisos. Uso: pnpm check-prices */
async function main() {
  const container = await buildContainer();
  const result = await container.checkPrices(console.log);
  console.log(
    `\nRevisados: ${result.checked} · Con error: ${result.failed.length} · Ofertas avisadas: ${result.deals} · Emails: ${result.emailsSent}`,
  );
}

// Se sale explícitamente: conexiones abiertas (base de datos, keep-alive HTTP) podrían mantener vivo el proceso.
main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
