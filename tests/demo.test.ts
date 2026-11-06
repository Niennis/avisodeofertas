import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/adapters/persistence/drizzle/db";
import { DrizzleFailureRepository } from "@/adapters/persistence/drizzle/failure-repository";
import { DrizzleGroupRepository } from "@/adapters/persistence/drizzle/group-repository";
import { DrizzleProductRepository } from "@/adapters/persistence/drizzle/product-repository";
import { DrizzleSessionRepository, DrizzleUserRepository } from "@/adapters/persistence/drizzle/user-repository";
import { DrizzleWatchRepository } from "@/adapters/persistence/drizzle/watch-repository";
import type { PriceReader } from "@/core/application/ports/price-reader";
import { DEMO_EXTRA_PRODUCTS, DemoService, type DemoDeps } from "@/core/application/use-cases/demo";
import { GroupService } from "@/core/application/use-cases/groups";
import { WatchService } from "@/core/application/use-cases/watches";
import { isDemo } from "@/core/domain/user";

/** Todas las tiendas "publican" el mismo precio: aquí solo importa la cuenta demo. */
const reader: PriceReader = {
  read: async () => ({ name: "Lana Merino", imageUrl: null, price: 5000, listPrice: null, currency: "CLP", available: true }),
};
const settings = { targetPrice: null, notifyOnSale: true };
const TEMPLATE = "plantilla@correo.cl";

describe("cuenta demo", () => {
  let now: Date;
  let users: DrizzleUserRepository;
  let sessions: DrizzleSessionRepository;
  let productRepo: DrizzleProductRepository;
  let watches: WatchService;
  let groups: GroupService;
  let demo: DemoService;
  let demoDeps: DemoDeps;

  beforeEach(async () => {
    now = new Date("2026-11-06T12:00:00Z");
    const clock = { now: () => now };
    const db = await createDatabase("pglite:memory");
    users = new DrizzleUserRepository(db);
    sessions = new DrizzleSessionRepository(db);
    productRepo = new DrizzleProductRepository(db);
    const watchRepo = new DrizzleWatchRepository(db);
    const groupRepo = new DrizzleGroupRepository(db);
    watches = new WatchService({
      products: productRepo,
      failures: new DrizzleFailureRepository(db),
      watches: watchRepo,
      groups: groupRepo,
      priceReader: reader,
      clock,
      users,
    });
    groups = new GroupService({ groups: groupRepo, watches: watchRepo, watchService: watches });
    demoDeps = { users, sessions, watches: watchRepo, groups: groupRepo, products: productRepo, clock, templateEmail: TEMPLATE };
    demo = new DemoService(demoDeps);

    // Cuenta plantilla con 3 productos, dos de ellos agrupados como "mismo producto en varias tiendas".
    const template = await users.create(TEMPLATE, "hash");
    const a = await watches.add(template.id, "https://orquidea.cl/products/merino", settings);
    const b = await watches.add(template.id, "https://revesderecho.cl/products/merino", settings);
    await watches.add(template.id, "https://salcobrand.cl/products/protector", settings);
    if (a.status !== "added" || b.status !== "added") throw new Error("no se pudo armar la plantilla");
    await groups.group(template.id, [a.watchId, b.watchId]);
  });

  async function startDemo() {
    const session = await demo.start();
    const user = (await sessions.findUser(session.token, now))!;
    return { session, user };
  }

  it("crea una cuenta propia con los productos y grupos de ejemplo, sin emails", async () => {
    const { session, user } = await startDemo();
    expect(isDemo(user)).toBe(true);
    expect(user.emailNotifications).toBe(false);
    expect(user.email).toMatch(/@demo\.invalid$/);
    expect(session.expiresAt).toEqual(new Date("2026-11-07T12:00:00Z"));

    const mine = await watches.list(user.id);
    expect(mine).toHaveLength(3);
    const grouped = mine.filter((w) => w.groupId != null);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].groupId).toBe(grouped[1].groupId);
  });

  it("cada visitante tiene su cuenta: lo que hace uno no afecta al otro ni a la plantilla", async () => {
    const first = await startDemo();
    const second = await startDemo();
    const [toRemove] = await watches.list(first.user.id);
    await watches.remove(first.user.id, toRemove.id);
    expect(await watches.list(first.user.id)).toHaveLength(2);
    expect(await watches.list(second.user.id)).toHaveLength(3);
    expect(await watches.list((await users.findByEmailWithPassword(TEMPLATE))!.id)).toHaveLength(3);
  });

  it(`permite agregar ${DEMO_EXTRA_PRODUCTS} productos más y ninguno después`, async () => {
    const { user } = await startDemo();
    for (let i = 0; i < DEMO_EXTRA_PRODUCTS; i++) {
      await watches.add(user.id, `https://tienda.cl/products/extra-${i}`, settings);
    }
    await expect(watches.add(user.id, "https://tienda.cl/products/uno-mas", settings)).rejects.toThrow("Llegaste al máximo");
    // "Agregar otra tienda" también cuenta.
    const [anchor] = await watches.list(user.id);
    await expect(groups.addStore(user.id, anchor.id, "https://otra.cl/products/merino")).rejects.toThrow("Llegaste al máximo");
  });

  it("las cuentas normales no tienen límite", async () => {
    const normal = await users.create("persona@correo.cl", "hash");
    for (let i = 0; i < 10; i++) await watches.add(normal.id, `https://tienda.cl/products/p-${i}`, settings);
    expect(await watches.list(normal.id)).toHaveLength(10);
  });

  it("al salir se borra la cuenta y los productos que solo seguía ella", async () => {
    const { user, session } = await startDemo();
    await watches.add(user.id, "https://tienda.cl/products/solo-demo", settings);
    await demo.end(user.id);
    expect(await sessions.findUser(session.token, now)).toBeNull();
    expect(await productRepo.findByUrl("https://tienda.cl/products/solo-demo")).toBeNull();
    // Los de ejemplo siguen, porque la plantilla los sigue.
    expect(await productRepo.findByUrl("https://salcobrand.cl/products/protector")).not.toBeNull();
  });

  it("la limpieza borra solo las demos vencidas, nunca las cuentas normales", async () => {
    const { user: old } = await startDemo();
    now = new Date("2026-11-07T06:00:00Z");
    const { user: recent } = await startDemo();
    now = new Date("2026-11-07T12:00:01Z");
    expect(await demo.cleanup()).toBe(1);
    expect(await users.findById(old.id)).toBeNull();
    expect(await users.findById(recent.id)).not.toBeNull();
    expect(await users.findByEmailWithPassword(TEMPLATE)).not.toBeNull();
  });

  it("borrar una demo nunca borra una cuenta normal", async () => {
    const normal = await users.create("persona@correo.cl", "hash");
    await users.deleteDemo(normal.id);
    expect(await users.findById(normal.id)).not.toBeNull();
  });

  it("sin cuenta plantilla, la demo está desactivada", async () => {
    const off = new DemoService({ ...demoDeps, templateEmail: null });
    expect(off.enabled).toBe(false);
    await expect(off.start()).rejects.toThrow("no está disponible");
  });
});
