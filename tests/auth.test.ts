import { describe, expect, it } from "vitest";
import type { Notifier } from "@/core/application/ports/notifier";
import type { PasswordHasher } from "@/core/application/ports/password-hasher";
import type { PasswordResetRepository } from "@/core/application/ports/password-reset-repository";
import type { SessionRepository } from "@/core/application/ports/session-repository";
import type { UserRepository, UserWithPassword } from "@/core/application/ports/user-repository";
import { AuthService, constantTimeEqual } from "@/core/application/use-cases/auth";

const ADMIN = "admin@ejemplo.cl";

/** Versión en memoria de los repositorios, para probar las reglas sin base de datos. */
function setup({ inviteCode = null as string | null } = {}) {
  let now = new Date("2026-11-06T12:00:00Z");
  const users = new Map<string, UserWithPassword>();
  const resets = new Map<string, { userId: string; expiresAt: Date; createdAt: Date }>();
  const sentLinks: { to: string; link: string }[] = [];
  let next = 0;

  const userRepo: UserRepository = {
    findById: async (id) => users.get(id) ?? null,
    findByEmailWithPassword: async (email) => [...users.values()].find((u) => u.email === email) ?? null,
    create: async (email, passwordHash) => {
      const user: UserWithPassword = {
        id: `u${++next}`,
        email,
        passwordHash,
        emailNotifications: true,
        palette: "sobria",
        createdAt: now,
        failedLogins: 0,
        lockedUntil: null,
        demoExpiresAt: null,
        watchLimit: null,
      };
      users.set(user.id, user);
      return user;
    },
    setPasswordHash: async (id, hash) => void (users.get(id)!.passwordHash = hash),
    setEmailNotifications: async () => {},
    setPalette: async () => {},
    incrementFailedLogins: async (id) => ++users.get(id)!.failedLogins,
    lockLogin: async (id, until) => void Object.assign(users.get(id)!, { failedLogins: 0, lockedUntil: until }),
    clearFailedLogins: async (id) => void Object.assign(users.get(id)!, { failedLogins: 0, lockedUntil: null }),
    // Las cuentas demo se prueban con la base de datos real, en demo.test.ts.
    createDemo: async () => {
      throw new Error("no se usa en estas pruebas");
    },
    deleteDemo: async () => {},
    deleteExpiredDemos: async () => 0,
  };
  const sessions: SessionRepository = {
    create: async (userId) => `sesion-${userId}-${++next}`,
    findUser: async () => null,
    delete: async () => {},
    deleteAllForUser: async () => {},
  };
  const resetRepo: PasswordResetRepository = {
    create: async (userId, expiresAt, createdAt) => {
      const token = `token-${++next}`;
      resets.set(token, { userId, expiresAt, createdAt });
      return token;
    },
    lastCreatedAt: async () => null,
    consume: async (token, at) => {
      const reset = resets.get(token);
      resets.delete(token);
      return reset && reset.expiresAt > at ? reset.userId : null;
    },
  };
  // Hash simple y reconocible: aquí solo importan las reglas, no el algoritmo.
  const hasher: PasswordHasher = {
    hash: async (password) => `hash:${password}`,
    verify: async (password, hash) => hash === `hash:${password}`,
  };
  const notifier: Notifier = {
    sendDeals: async () => {},
    sendFailureReport: async () => {},
    sendPasswordReset: async (to, link) => void sentLinks.push({ to, link }),
  };
  const auth = new AuthService({
    users: userRepo,
    sessions,
    resets: resetRepo,
    hasher,
    notifier,
    clock: { now: () => now },
    inviteCode,
    adminEmail: ADMIN,
  });
  return {
    auth,
    users,
    sentLinks,
    advanceMinutes: (minutes: number) => (now = new Date(now.getTime() + minutes * 60_000)),
  };
}

const base = { inviteCode: "", baseUrl: "https://app.ejemplo.cl" };

describe("cuenta de administración", () => {
  it("no entra al registrarse: se crea sin contraseña y llega un enlace a ese email", async () => {
    const { auth, sentLinks } = setup();
    const result = await auth.register({ ...base, email: " Admin@Ejemplo.cl ", password: "la-del-intruso" });
    expect(result).toEqual({ status: "check-email" });
    await expect(auth.login({ email: ADMIN, password: "la-del-intruso" })).rejects.toThrow("Email o contraseña incorrectos.");
    expect(sentLinks).toHaveLength(1);
    expect(sentLinks[0].to).toBe(ADMIN);
    expect(sentLinks[0].link).toMatch(/^https:\/\/app\.ejemplo\.cl\/restablecer\?token=/);
  });

  it("con el enlace del email se crea la contraseña y se puede entrar", async () => {
    const { auth, sentLinks } = setup();
    await auth.register({ ...base, email: ADMIN, password: "cualquiera1" });
    const token = new URL(sentLinks[0].link).searchParams.get("token")!;
    await auth.resetPassword({ token, password: "la-de-verdad" });
    await expect(auth.login({ email: ADMIN, password: "la-de-verdad" })).resolves.toHaveProperty("token");
  });

  it("las demás cuentas entran al registrarse", async () => {
    const { auth } = setup();
    const result = await auth.register({ ...base, email: "persona@ejemplo.cl", password: "contraseña1" });
    expect(result.status).toBe("signed-in");
  });
});

describe("intentos fallidos al ingresar", () => {
  async function withAccount() {
    const ctx = setup();
    await ctx.auth.register({ ...base, email: "persona@ejemplo.cl", password: "correcta123" });
    return ctx;
  }
  const wrong = { email: "persona@ejemplo.cl", password: "incorrecta" };
  const right = { email: "persona@ejemplo.cl", password: "correcta123" };

  it("tras 5 intentos fallidos bloquea el ingreso, aunque la contraseña sea la correcta", async () => {
    const { auth } = await withAccount();
    for (let i = 0; i < 5; i++) await expect(auth.login(wrong)).rejects.toThrow("Email o contraseña incorrectos.");
    await expect(auth.login(right)).rejects.toThrow("demasiados intentos fallidos");
  });

  it("el bloqueo dura 15 minutos", async () => {
    const { auth, advanceMinutes } = await withAccount();
    for (let i = 0; i < 5; i++) await auth.login(wrong).catch(() => {});
    advanceMinutes(14);
    await expect(auth.login(right)).rejects.toThrow("demasiados intentos fallidos");
    advanceMinutes(2);
    await expect(auth.login(right)).resolves.toHaveProperty("token");
  });

  it("un ingreso correcto reinicia la cuenta de intentos", async () => {
    const { auth, users } = await withAccount();
    for (let i = 0; i < 4; i++) await auth.login(wrong).catch(() => {});
    await auth.login(right);
    expect([...users.values()][0].failedLogins).toBe(0);
  });

  it("crear una contraseña nueva con el enlace quita el bloqueo", async () => {
    const { auth, sentLinks } = await withAccount();
    for (let i = 0; i < 5; i++) await auth.login(wrong).catch(() => {});
    await auth.requestPasswordReset({ email: "persona@ejemplo.cl", baseUrl: base.baseUrl });
    const token = new URL(sentLinks[0].link).searchParams.get("token")!;
    await expect(auth.resetPassword({ token, password: "nueva-clave" })).resolves.toHaveProperty("token");
    await expect(auth.login({ email: "persona@ejemplo.cl", password: "nueva-clave" })).resolves.toHaveProperty("token");
  });

  it("con un email sin cuenta responde lo mismo que con una contraseña incorrecta", async () => {
    const { auth } = await withAccount();
    await expect(auth.login({ email: "nadie@ejemplo.cl", password: "x" })).rejects.toThrow("Email o contraseña incorrectos.");
  });
});

describe("código de invitación", () => {
  it("se exige si está configurado", async () => {
    const { auth } = setup({ inviteCode: "lana-2026" });
    await expect(auth.register({ ...base, inviteCode: "lana-2025", email: "a@b.cl", password: "contraseña1" })).rejects.toThrow(
      "El código de invitación no es correcto.",
    );
    await expect(auth.register({ ...base, inviteCode: " lana-2026 ", email: "a@b.cl", password: "contraseña1" })).resolves.toMatchObject({
      status: "signed-in",
    });
  });

  it("la comparación distingue largo y contenido", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});
