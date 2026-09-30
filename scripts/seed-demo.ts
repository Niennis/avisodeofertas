import "./load-env";
import { createDatabase } from "../src/adapters/persistence/drizzle/db";
import { DrizzleProductRepository } from "../src/adapters/persistence/drizzle/product-repository";
import { DrizzleUserRepository } from "../src/adapters/persistence/drizzle/user-repository";
import { DrizzleWatchRepository } from "../src/adapters/persistence/drizzle/watch-repository";
import { ScryptPasswordHasher } from "../src/adapters/security/scrypt-password-hasher";

/**
 * Crea una cuenta de demostración con muchos productos ficticios, para probar el diseño
 * y la carga progresiva. Solo funciona con una base local PGlite, nunca con Neon.
 *
 * Uso: DATABASE_URL=pglite:.pglite-demo pnpm seed-demo [cantidad]
 */
const IMAGES = [
  "https://www.reginella.cl/3229-home_default/alaska-perla.jpg",
  "https://lanamovil.cl/wp-content/uploads/2025/12/AMGR08-09-scaled-1.webp",
  "https://cdn.shopify.com/s/files/1/0750/6595/0508/files/bamboo-verdemanzana.jpg?v=1736788795",
  "https://static.salcobrand.cl/spree/products/96813/large/4100568.jpg?1691534414",
  null,
];
const STORES = ["Orquídea", "Revés Derecho", "Modista", "Reginella", "Lana Móvil", "Cruz Verde", "Salcobrand"];
const NAMES = ["Merino Extrafino", "Algodón Paris", "Alpaca Suave", "Bamboo 100 g", "Protector Solar FPS 50", "Lana Alaska"];
const COLORS = ["Perla", "Azul Marino", "Verde Manzana", "Crudo", "Terracota", "Negro", "Rosa Viejo"];

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("pglite:")) {
    console.error("Por seguridad, este script solo funciona con DATABASE_URL=pglite:<carpeta>.");
    process.exit(1);
  }
  const count = Number(process.argv[2] ?? 60);
  const email = "demo@correo.cl";
  const password = "clave-segura";

  const db = await createDatabase(url);
  const users = new DrizzleUserRepository(db);
  const user =
    (await users.findByEmailWithPassword(email)) ??
    (await users.create(email, await new ScryptPasswordHasher().hash(password)));
  const products = new DrizzleProductRepository(db);
  const watches = new DrizzleWatchRepository(db);
  for (let i = 0; i < count; i++) {
    const price = 1990 + ((i * 7919) % 30) * 500;
    const onSale = i % 3 === 0;
    const product = await products.create({
      url: `https://demo.invalid/producto-${i}`,
      store: STORES[i % STORES.length],
      reading: {
        name: `${NAMES[i % NAMES.length]} ${COLORS[i % COLORS.length]}${i % 4 === 0 ? " – presentación de 250 gramos" : ""}`,
        imageUrl: IMAGES[i % IMAGES.length],
        price,
        listPrice: onSale ? Math.round(price * 1.25) : null,
        currency: "CLP",
        available: i % 11 === 5 ? false : true,
      },
      checkedAt: new Date(),
    });
    if (i % 17 === 8) await products.recordError(product.id, "La tienda no respondió a tiempo", new Date());
    await watches.create(user.id, product.id, { notifyOnSale: true, targetPrice: i % 5 === 0 ? price + 1000 : null });
  }
  console.log(`Listo: ${count} productos para ${email} (contraseña: ${password}).`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
