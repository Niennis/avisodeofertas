import "./load-env";
import { SmtpNotifier } from "../src/adapters/notifications/smtp-notifier";
import { loadConfig } from "../src/composition/config";

/**
 * Envía un aviso de ejemplo para comprobar la configuración SMTP.
 * Uso: pnpm test-email [destinatario]   (por defecto, a SMTP_USER)
 */
async function main() {
  const config = loadConfig();
  if (!config.smtp) {
    console.error("Falta configurar SMTP_HOST, SMTP_USER y SMTP_PASS en .env.local");
    process.exit(1);
  }
  const to = process.argv[2] ?? config.smtp.user;
  const notifier = new SmtpNotifier(config.smtp, config.appUrl);
  await notifier.sendDeals(to, [
    {
      productId: "ejemplo",
      name: "Alaska Perla (email de prueba)",
      store: "Reginella",
      url: "https://www.reginella.cl/alaska/684-alaska-perla.html",
      imageUrl: "https://www.reginella.cl/3229-home_default/alaska-perla.jpg",
      currency: "CLP",
      price: 1249,
      listPrice: 1470,
      targetPrice: null,
      reasons: ["on_sale"],
      variants: [],
    },
  ]);
  console.log(`Email de prueba enviado a ${to}. Revisa tu bandeja de entrada (y la carpeta de spam).`);
}

main().then(
  () => process.exit(0),
  (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`No se pudo enviar: ${message}`);
    if (/Invalid login|Username and Password not accepted|535/i.test(message)) {
      console.error("Gmail rechazó el usuario o la contraseña: revisa SMTP_USER y que SMTP_PASS sea la contraseña de aplicación, sin espacios.");
    }
    process.exit(1);
  },
);
