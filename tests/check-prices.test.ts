import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/adapters/persistence/drizzle/db";
import { DrizzleFailureRepository } from "@/adapters/persistence/drizzle/failure-repository";
import { DrizzleGroupRepository } from "@/adapters/persistence/drizzle/group-repository";
import { DrizzleProductRepository } from "@/adapters/persistence/drizzle/product-repository";
import { DrizzlePasswordResetRepository, DrizzleSessionRepository, DrizzleUserRepository } from "@/adapters/persistence/drizzle/user-repository";
import { DrizzleWatchRepository } from "@/adapters/persistence/drizzle/watch-repository";
import { ScryptPasswordHasher } from "@/adapters/security/scrypt-password-hasher";
import type { Deal, Notifier } from "@/core/application/ports/notifier";
import type { PriceReader } from "@/core/application/ports/price-reader";
import { AccountService } from "@/core/application/use-cases/account";
import { AdminService } from "@/core/application/use-cases/admin";
import { AuthService } from "@/core/application/use-cases/auth";
import { checkPrices } from "@/core/application/use-cases/check-prices";
import { GroupService } from "@/core/application/use-cases/groups";
import { WatchService } from "@/core/application/use-cases/watches";
import { PriceUnavailableError } from "@/core/domain/errors";
import type { StoreFailures } from "@/core/domain/failures";
import type { PriceReading } from "@/core/domain/price";

/** Lector falso: el test decide qué precio "publica" cada tienda. */
class FakePriceReader implements PriceReader {
  prices = new Map<string, Partial<PriceReading> | Error>();
  async read(url: string): Promise<PriceReading> {
    const entry = this.prices.get(url);
    if (entry instanceof Error) throw entry;
    return { name: "Lana Merino", imageUrl: null, price: 5000, listPrice: null, currency: "CLP", available: true, ...entry };
  }
}

class FakeNotifier implements Notifier {
  sent: { to: string; deals: Deal[] }[] = [];
  failureReports: { to: string; stores: StoreFailures[] }[] = [];
  resetLinks: { to: string; link: string }[] = [];
  async sendDeals(to: string, deals: Deal[]) {
    this.sent.push({ to, deals });
  }
  async sendFailureReport(to: string, stores: StoreFailures[]) {
    this.failureReports.push({ to, stores });
  }
  async sendPasswordReset(to: string, link: string) {
    this.resetLinks.push({ to, link });
  }
}

const URL_A = "https://www.orquidea.cl/products/merino";
const URL_B = "https://salcobrand.cl/products/protector";

describe("flujo completo con base de datos", () => {
  let reader: FakePriceReader;
  let notifier: FakeNotifier;
  let auth: AuthService;
  let account: AccountService;
  let groups: GroupService;
  let failureRepo: DrizzleFailureRepository;
  let watches: WatchService;
  let run: () => ReturnType<typeof checkPrices>;
  let clock: { now: () => Date };

  beforeEach(async () => {
    const db = await createDatabase("pglite:memory");
    const products = new DrizzleProductRepository(db);
    const watchRepo = new DrizzleWatchRepository(db);
    clock = { now: () => new Date() };
    account = new AccountService(new DrizzleUserRepository(db));
    reader = new FakePriceReader();
    notifier = new FakeNotifier();
    auth = new AuthService({
      users: new DrizzleUserRepository(db),
      sessions: new DrizzleSessionRepository(db),
      resets: new DrizzlePasswordResetRepository(db),
      hasher: new ScryptPasswordHasher(),
      notifier,
      clock,
      inviteCode: "lanas2026",
    });
    const groupRepo = new DrizzleGroupRepository(db);
    failureRepo = new DrizzleFailureRepository(db);
    watches = new WatchService({ products, failures: failureRepo, watches: watchRepo, groups: groupRepo, priceReader: reader, clock });
    groups = new GroupService({ groups: groupRepo, watches: watchRepo, watchService: watches });
    run = () =>
      checkPrices({ products, failures: failureRepo, watches: watchRepo, priceReader: reader, notifier, clock, adminEmail: "admin@correo.cl" });
  });

  /** Agrega y devuelve el id del seguimiento (falla si hubo un conflicto). */
  async function follow(userId: string, url: string, settings = { notifyOnSale: true, targetPrice: null as number | null }) {
    const result = await watches.add(userId, url, settings);
    if (result.status !== "added") throw new Error(`Se esperaba "added" y llegó "${result.status}"`);
    return result.watchId;
  }

  async function newUser(email: string) {
    const session = await auth.register({ email, password: "clave-segura", inviteCode: "lanas2026" });
    return (await auth.currentUser(session.token))!;
  }

  it("registro, login y rechazo de código de invitación incorrecto", async () => {
    await newUser("Ana@Correo.cl");
    const session = await auth.login({ email: "ana@correo.cl", password: "clave-segura" });
    expect((await auth.currentUser(session.token))?.email).toBe("ana@correo.cl");
    await expect(auth.login({ email: "ana@correo.cl", password: "otra-clave" })).rejects.toThrow("incorrectos");
    await expect(
      auth.register({ email: "b@correo.cl", password: "clave-segura", inviteCode: "x" }),
    ).rejects.toThrow("invitación");
    await auth.logout(session.token);
    expect(await auth.currentUser(session.token)).toBeNull();
  });

  describe("recuperar contraseña", () => {
    const BASE = "https://ofertas.cl";
    const tokenFrom = (link: string) => new URL(link).searchParams.get("token")!;

    it("envía un enlace, cambia la contraseña, cierra las sesiones anteriores y no deja reutilizarlo", async () => {
      await newUser("ana@correo.cl");
      const old = await auth.login({ email: "ana@correo.cl", password: "clave-segura" });

      await auth.requestPasswordReset({ email: " Ana@Correo.cl ", baseUrl: `${BASE}/` });
      expect(notifier.resetLinks).toHaveLength(1);
      const { to, link } = notifier.resetLinks[0];
      expect(to).toBe("ana@correo.cl");
      expect(link.startsWith(`${BASE}/restablecer?token=`)).toBe(true);

      // Una contraseña corta no gasta el enlace.
      await expect(auth.resetPassword({ token: tokenFrom(link), password: "corta" })).rejects.toThrow("8 caracteres");

      const session = await auth.resetPassword({ token: tokenFrom(link), password: "clave-nueva-123" });
      expect((await auth.currentUser(session.token))?.email).toBe("ana@correo.cl");
      expect(await auth.currentUser(old.token)).toBeNull();
      await expect(auth.login({ email: "ana@correo.cl", password: "clave-segura" })).rejects.toThrow("incorrectos");
      await auth.login({ email: "ana@correo.cl", password: "clave-nueva-123" });

      await expect(auth.resetPassword({ token: tokenFrom(link), password: "otra-clave-456" })).rejects.toThrow("no es válido");
    });

    it("no revela si el email no tiene cuenta y no envía varios enlaces seguidos", async () => {
      await auth.requestPasswordReset({ email: "nadie@correo.cl", baseUrl: BASE });
      expect(notifier.resetLinks).toHaveLength(0);

      await newUser("ana@correo.cl");
      await auth.requestPasswordReset({ email: "ana@correo.cl", baseUrl: BASE });
      await auth.requestPasswordReset({ email: "ana@correo.cl", baseUrl: BASE });
      expect(notifier.resetLinks).toHaveLength(1);
    });

    it("el enlace vence a la hora y uno nuevo invalida el anterior", async () => {
      await newUser("ana@correo.cl");
      let now = Date.now();
      clock.now = () => new Date(now);

      await auth.requestPasswordReset({ email: "ana@correo.cl", baseUrl: BASE });
      now += 61 * 60 * 1000;
      const expired = tokenFrom(notifier.resetLinks[0].link);
      await expect(auth.resetPassword({ token: expired, password: "clave-nueva-123" })).rejects.toThrow("venció");

      await auth.requestPasswordReset({ email: "ana@correo.cl", baseUrl: BASE });
      now += 2 * 60 * 1000;
      await auth.requestPasswordReset({ email: "ana@correo.cl", baseUrl: BASE });
      const [, second, third] = notifier.resetLinks.map((r) => tokenFrom(r.link));
      await expect(auth.resetPassword({ token: second, password: "clave-nueva-123" })).rejects.toThrow("no es válido");
      await auth.resetPassword({ token: third, password: "clave-nueva-123" });
    });
  });

  it("avisa una sola vez por oferta y agrupa por usuario", async () => {
    const ana = await newUser("ana@correo.cl");
    const bea = await newUser("bea@correo.cl");
    await watches.add(ana.id, URL_A, { notifyOnSale: true, targetPrice: null });
    await watches.add(ana.id, URL_B, { notifyOnSale: false, targetPrice: 3000 });
    await watches.add(bea.id, `${URL_A}?utm_source=instagram`, { notifyOnSale: true, targetPrice: null });

    // Sin ofertas: no hay avisos.
    await run();
    expect(notifier.sent).toHaveLength(0);

    // Merino rebajada y protector bajo el objetivo de Ana.
    reader.prices.set(URL_A, { price: 4000, listPrice: 5000 });
    reader.prices.set(URL_B, { name: "Protector", price: 2990 });
    const result = await run();
    expect(result).toMatchObject({ checked: 2, emailsSent: 2, deals: 3 });
    const toAna = notifier.sent.find((s) => s.to === "ana@correo.cl")!;
    expect(toAna.deals.map((d) => [d.name, d.reasons])).toEqual(
      expect.arrayContaining([
        ["Lana Merino", ["on_sale"]],
        ["Protector", ["below_target"]],
      ]),
    );

    // Mismo precio al día siguiente: no se repite.
    notifier.sent = [];
    await run();
    expect(notifier.sent).toHaveLength(0);

    // Baja aún más: se vuelve a avisar solo por ese producto.
    reader.prices.set(URL_A, { price: 3500, listPrice: 5000 });
    await run();
    expect(notifier.sent.map((s) => s.to).sort()).toEqual(["ana@correo.cl", "bea@correo.cl"]);
    expect(notifier.sent.every((s) => s.deals.length === 1)).toBe(true);
  });

  it("no envía emails a quien los desactivó y le avisa de lo vigente al reactivarlos", async () => {
    const ana = await newUser("ana@correo.cl");
    const bea = await newUser("bea@correo.cl");
    expect(ana.emailNotifications).toBe(true);
    await watches.add(ana.id, URL_A, { notifyOnSale: true, targetPrice: null });
    await watches.add(bea.id, URL_A, { notifyOnSale: true, targetPrice: null });
    await account.setEmailNotifications(bea.id, false);

    reader.prices.set(URL_A, { price: 4000, listPrice: 5000 });
    await run();
    expect(notifier.sent.map((s) => s.to)).toEqual(["ana@correo.cl"]);

    notifier.sent = [];
    await account.setEmailNotifications(bea.id, true);
    await run();
    expect(notifier.sent.map((s) => s.to)).toEqual(["bea@correo.cl"]);
  });

  it("guarda la paleta elegida y rechaza las que no existen", async () => {
    const ana = await newUser("ana@correo.cl");
    expect(ana.palette).toBe("sobria");
    await account.setPalette(ana.id, "jardin");
    const session = await auth.login({ email: "ana@correo.cl", password: "clave-segura" });
    expect((await auth.currentUser(session.token))?.palette).toBe("jardin");
    await expect(account.setPalette(ana.id, "comic-sans")).rejects.toThrow("no existe");
  });

  it("sigue una línea de colores, respeta los desmarcados y dice en el aviso qué colores bajaron", async () => {
    const ana = await newUser("ana@correo.cl");
    const line = (sale: string[]) => ({
      name: "Roma",
      variants: ["Beige", "Lila", "Negro"].map((name) => ({
        key: name.toLowerCase(),
        name,
        price: sale.includes(name) ? 2032 : 2390,
        listPrice: sale.includes(name) ? 2390 : null,
        available: true,
        url: null,
        imageUrl: null,
      })),
      price: 2390,
    });
    reader.prices.set(URL_A, line([]));
    const watchId = await follow(ana.id, URL_A, { notifyOnSale: true, targetPrice: null });

    // Desmarca Lila: su oferta no debe generar aviso.
    await watches.selectVariants(ana.id, watchId, ["beige", "negro"]);
    reader.prices.set(URL_A, line(["Lila"]));
    await run();
    expect(notifier.sent).toHaveLength(0);

    reader.prices.set(URL_A, line(["Lila", "Negro"]));
    await run();
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].deals[0]).toMatchObject({ name: "Roma", price: 2032, listPrice: 2390, variants: ["Negro"] });

    const [listed] = await watches.list(ana.id);
    expect(listed.product.variants).toHaveLength(3);
    expect(listed.excludedVariants).toEqual(["lila"]);
    await expect(watches.selectVariants(ana.id, watchId, [])).rejects.toThrow("al menos un color");
  });

  describe("evita tarjetas repetidas entre una línea y sus colores", () => {
    const LINE = "https://www.reginella.cl/2188-roma";
    const colorUrl = (slug: string) => `https://www.reginella.cl/roma/${slug}.html`;
    const colors = ["Apricot", "Lila", "Negro"].map((name, i) => ({
      key: String(100 + i),
      name,
      price: 2390,
      listPrice: null,
      available: true,
      url: colorUrl(`${100 + i}-roma-${name.toLowerCase()}`),
      imageUrl: null,
    }));
    const settings = { notifyOnSale: true, targetPrice: null };

    beforeEach(() => {
      reader.prices.set(LINE, { name: "Roma", variants: colors });
    });

    it("si ya sigue la línea, avisa en vez de crear el color aparte", async () => {
      const ana = await newUser("ana@correo.cl");
      const lineId = await follow(ana.id, LINE);

      const result = await watches.add(ana.id, "http://reginella.cl/roma/100-roma-apricot.html?utm_source=ig", settings);
      expect(result).toMatchObject({ status: "color-in-line", lineWatchId: lineId, lineName: "Roma", colorName: "Apricot", excluded: false });
      expect(await watches.list(ana.id)).toHaveLength(1);

      // Si el color estaba desmarcado, se puede volver a marcar en la línea.
      await watches.selectVariants(ana.id, lineId, ["101", "102"]);
      const again = await watches.add(ana.id, colors[0].url, settings);
      expect(again).toMatchObject({ status: "color-in-line", excluded: true });
      expect(await watches.add(ana.id, colors[0].url, settings, "include-in-line")).toMatchObject({
        status: "included-in-line",
        colorName: "Apricot",
      });
      expect((await watches.list(ana.id))[0].excludedVariants).toEqual([]);

      // Y también se puede seguir por separado, a propósito.
      expect(await watches.add(ana.id, colors[0].url, settings, "separate")).toMatchObject({ status: "added" });
      expect(await watches.list(ana.id)).toHaveLength(2);
    });

    it("si ya sigue colores sueltos, pregunta y puede reemplazarlos por la línea con solo esos colores", async () => {
      const ana = await newUser("ana@correo.cl");
      await follow(ana.id, colors[0].url);
      await follow(ana.id, colors[1].url);

      const result = await watches.add(ana.id, LINE, settings);
      expect(result).toMatchObject({ status: "line-has-colors", name: "Roma" });
      expect(result.status === "line-has-colors" && result.colors.map((c) => c.name)).toEqual(["Apricot", "Lila"]);
      expect(await watches.list(ana.id)).toHaveLength(2);

      expect(await watches.add(ana.id, LINE, settings, "line-only-mine")).toMatchObject({
        status: "added",
        variantCount: 2,
        replaced: 2,
      });
      const [line, ...rest] = await watches.list(ana.id);
      expect(rest).toHaveLength(0);
      expect(line.product.name).toBe("Roma");
      expect(line.excludedVariants).toEqual(["102"]);
    });

    it("o por la línea completa", async () => {
      const ana = await newUser("ana@correo.cl");
      await follow(ana.id, colors[2].url);
      expect(await watches.add(ana.id, LINE, settings, "line-all")).toMatchObject({ status: "added", variantCount: 3, replaced: 1 });
      const list = await watches.list(ana.id);
      expect(list.map((w) => [w.product.name, w.excludedVariants])).toEqual([["Roma", []]]);
    });
  });

  describe("grupos de mismo producto en varias tiendas", () => {
    const CV = "https://www.cruzverde.cl/gel-cerave/123.html";
    const AH = "https://www.farmaciasahumada.cl/cerave-limpiador-456.html";
    const SB = "https://salcobrand.cl/products/limpiador-piel-grasa";

    it("agrupa, agrega otra tienda copiando condiciones, renombra y se deshace al quedar una sola", async () => {
      const ana = await newUser("ana@correo.cl");
      const cv = await follow(ana.id, CV, { notifyOnSale: false, targetPrice: 9990 });
      const ah = await follow(ana.id, AH);

      const groupId = await groups.group(ana.id, [cv, ah]);
      expect((await groups.detail(ana.id, groupId)).members).toHaveLength(2);

      // "Agregar otra tienda" desde un miembro: sigue el enlace nuevo con las condiciones de ese miembro.
      const added = await groups.addStore(ana.id, cv, SB);
      expect(added.groupId).toBe(groupId);
      const members = (await groups.detail(ana.id, groupId)).members;
      expect(members).toHaveLength(3);
      expect(members.find((m) => m.product.url === SB)).toMatchObject({ notifyOnSale: false, targetPrice: 9990 });

      await groups.rename(ana.id, groupId, "  Gel limpiador   CeraVe ");
      expect((await groups.detail(ana.id, groupId)).name).toBe("Gel limpiador CeraVe");

      // Quitar una tienda deja 2; dejar de seguir otra deja 1 y el grupo se deshace.
      expect(await groups.removeMember(ana.id, groupId, ah)).toBe(true);
      await watches.remove(ana.id, cv);
      await expect(groups.detail(ana.id, groupId)).rejects.toThrow("No encontramos ese grupo");
      const remaining = await watches.list(ana.id);
      expect(remaining.map((w) => [w.product.url, w.groupId])).toEqual(
        expect.arrayContaining([
          [SB, null],
          [AH, null],
        ]),
      );
    });

    it("si el enlace de la otra tienda ya lo seguía suelto, lo mueve al grupo sin duplicarlo", async () => {
      const ana = await newUser("ana@correo.cl");
      const cv = await follow(ana.id, CV);
      await follow(ana.id, AH);
      const { groupId } = await groups.addStore(ana.id, cv, `${AH}?utm_source=ig`);
      expect(await watches.list(ana.id)).toHaveLength(2);
      expect((await groups.detail(ana.id, groupId)).members).toHaveLength(2);
      await expect(groups.addStore(ana.id, cv, CV)).rejects.toThrow("otra tienda");
    });

    it("fusiona grupos y no deja tocar los de otra persona", async () => {
      const ana = await newUser("ana@correo.cl");
      const bea = await newUser("bea@correo.cl");
      const [a, b, c, d] = await Promise.all(
        ["https://a.cl/p/1", "https://b.cl/p/2", "https://c.cl/p/3", "https://d.cl/p/4"].map((url) => follow(ana.id, url)),
      );
      await expect(groups.group(ana.id, [a])).rejects.toThrow("al menos otro");
      const g1 = await groups.group(ana.id, [a, b]);
      const g2 = await groups.group(ana.id, [c, d]);
      expect(await groups.group(ana.id, [b, c])).toBe(g1);
      expect((await groups.detail(ana.id, g1)).members).toHaveLength(4);
      await expect(groups.detail(ana.id, g2)).rejects.toThrow("No encontramos");
      await expect(groups.detail(bea.id, g1)).rejects.toThrow("No encontramos");

      await groups.ungroup(ana.id, g1);
      expect((await watches.list(ana.id)).every((w) => w.groupId === null)).toBe(true);
    });
  });

  describe("reportes de enlaces que no se pueden leer", () => {
    it("al agregar: registra el intento y le dice a la persona que quedó registrado", async () => {
      const ana = await newUser("ana@correo.cl");
      reader.prices.set("https://www.tienda-rara.cl/p/1", new PriceUnavailableError("unsupported", "sin precio reconocible"));
      await expect(watches.add(ana.id, "https://www.tienda-rara.cl/p/1", { notifyOnSale: true, targetPrice: null })).rejects.toThrow(
        "Todavía no sabemos leer el precio de esta tienda. Ya quedó registrado para revisarlo.",
      );
      const [report] = await failureRepo.listAll();
      expect(report).toMatchObject({ host: "tienda-rara.cl", problem: "unsupported", source: "add", userId: ana.id });

      // Una caída pasajera también se registra, pero sin prometer una revisión.
      reader.prices.set("https://otra.cl/p/2", new PriceUnavailableError("unavailable", "timeout"));
      await expect(watches.add(ana.id, "https://otra.cl/p/2", { notifyOnSale: true, targetPrice: null })).rejects.toThrow(
        /^La tienda no respondió bien/,
      );
      expect(await failureRepo.listAll()).toHaveLength(2);
    });

    it("en la revisión: reporta al segundo fallo seguido, una sola vez, y avisa a quien administra", async () => {
      const ana = await newUser("ana@correo.cl");
      await follow(ana.id, URL_A);
      reader.prices.set(URL_A, new PriceUnavailableError("blocked", "403"));

      await run();
      expect(await failureRepo.listAll()).toHaveLength(0);
      expect(notifier.failureReports).toHaveLength(0);

      await run();
      expect(await failureRepo.listAll()).toMatchObject([{ problem: "blocked", source: "check", userId: null }]);
      expect(notifier.failureReports).toHaveLength(1);
      expect(notifier.failureReports[0]).toMatchObject({ to: "admin@correo.cl", stores: [{ host: "orquidea.cl", count: 1 }] });

      // Sigue fallando: no se repite el reporte ni el email.
      await run();
      expect(await failureRepo.listAll()).toHaveLength(1);
      expect(notifier.failureReports).toHaveLength(1);

      // Se recupera y vuelve a fallar dos veces: es una racha nueva.
      reader.prices.set(URL_A, { price: 5000 });
      await run();
      reader.prices.set(URL_A, new PriceUnavailableError("unavailable"));
      await run();
      await run();
      expect(await failureRepo.listAll()).toHaveLength(2);
      expect(notifier.failureReports).toHaveLength(2);
    });

    it("la administración ve los fallos por tienda y puede darlos por resueltos", async () => {
      const admin = new AdminService(failureRepo, "Admin@Correo.cl");
      expect(admin.isAdmin({ email: "admin@correo.cl" })).toBe(true);
      expect(admin.isAdmin({ email: "ana@correo.cl" })).toBe(false);
      expect(new AdminService(failureRepo, null).isAdmin({ email: "admin@correo.cl" })).toBe(false);

      for (const url of ["https://a.cl/1", "https://www.a.cl/2", "https://b.cl/3"]) {
        await failureRepo.record({ url, problem: "unsupported", message: "x", detail: null, source: "add", userId: null });
      }
      expect((await admin.failuresByStore()).map((s) => [s.host, s.count])).toEqual(
        expect.arrayContaining([
          ["a.cl", 2],
          ["b.cl", 1],
        ]),
      );
      await admin.resolveStore("a.cl");
      expect((await admin.failuresByStore()).map((s) => s.host)).toEqual(["b.cl"]);
    });
  });

  it("registra errores sin interrumpir la revisión del resto", async () => {
    const ana = await newUser("ana@correo.cl");
    await watches.add(ana.id, URL_A, { notifyOnSale: true, targetPrice: null });
    await watches.add(ana.id, URL_B, { notifyOnSale: true, targetPrice: null });
    reader.prices.set(URL_A, new Error("La tienda no respondió a tiempo"));
    reader.prices.set(URL_B, { price: 900, listPrice: 1000 });

    const result = await run();
    expect(result.failed).toEqual([{ url: URL_A, error: "La tienda no respondió a tiempo" }]);
    expect(result.deals).toBe(1);
    const list = await watches.list(ana.id);
    expect(list.find((w) => w.product.url === URL_A)?.product.lastError).toBe("La tienda no respondió a tiempo");
  });

  it("guarda historial y elimina productos que nadie sigue", async () => {
    const ana = await newUser("ana@correo.cl");
    const watchId = await follow(ana.id, URL_A, { notifyOnSale: true, targetPrice: null });
    reader.prices.set(URL_A, { price: 4500, listPrice: 5000 });
    await run();

    const { history } = await watches.detail(ana.id, watchId);
    expect(history.map((h) => h.price)).toEqual([5000, 4500]);

    await expect(watches.add(ana.id, URL_A, { notifyOnSale: true, targetPrice: null })).rejects.toThrow("Ya estás");
    await watches.remove(ana.id, watchId);
    expect(await watches.list(ana.id)).toHaveLength(0);
    expect((await run()).checked).toBe(0);
  });

  it("un usuario no puede ver ni borrar productos de otro", async () => {
    const ana = await newUser("ana@correo.cl");
    const bea = await newUser("bea@correo.cl");
    const watchId = await follow(ana.id, URL_A, { notifyOnSale: true, targetPrice: null });
    await expect(watches.detail(bea.id, watchId)).rejects.toThrow("No encontramos");
    await expect(watches.remove(bea.id, watchId)).rejects.toThrow("No encontramos");
  });
});
