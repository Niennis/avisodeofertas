import { DomainError } from "@/core/domain/errors";
import { normalizeEmail, type User } from "@/core/domain/user";
import type { Clock } from "../ports/clock";
import type { Notifier } from "../ports/notifier";
import type { PasswordHasher } from "../ports/password-hasher";
import type { PasswordResetRepository } from "../ports/password-reset-repository";
import type { SessionRepository } from "../ports/session-repository";
import type { UserRepository } from "../ports/user-repository";

const SESSION_DAYS = 30;
const MIN_PASSWORD_LENGTH = 8;
const RESET_VALID_MINUTES = 60;
/** Evita llenar la bandeja de alguien pidiendo enlaces seguidos. */
const RESET_COOLDOWN_MS = 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Intentos fallidos seguidos antes de bloquear el ingreso a esa cuenta por un rato (evita adivinar la contraseña). */
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MINUTES = 15;
/** Hash que ninguna contraseña cumple: la cuenta existe, pero solo se entra creando la contraseña con el enlace del email. */
const UNUSABLE_PASSWORD_HASH = "pendiente";

export interface AuthDeps {
  users: UserRepository;
  sessions: SessionRepository;
  resets: PasswordResetRepository;
  hasher: PasswordHasher;
  notifier: Notifier;
  clock: Clock;
  /** Si está definido, se exige para crear una cuenta (evita registros de desconocidos). */
  inviteCode: string | null;
  /** Email de quien administra la app; para crear esa cuenta hay que demostrar que el email es propio. */
  adminEmail: string | null;
}

export interface Session {
  token: string;
  expiresAt: Date;
}

export type RegisterResult = { status: "signed-in"; session: Session } | { status: "check-email" };

export class AuthService {
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly deps: AuthDeps) {}

  async register(input: { email: string; password: string; inviteCode: string; baseUrl: string | null }): Promise<RegisterResult> {
    const { users, hasher, inviteCode, adminEmail, clock } = this.deps;
    if (inviteCode && !constantTimeEqual(input.inviteCode.trim(), inviteCode)) {
      throw new DomainError("El código de invitación no es correcto.");
    }
    const email = normalizeEmail(input.email);
    if (!EMAIL_PATTERN.test(email)) throw new DomainError("Ingresa un email válido.");
    validatePassword(input.password);
    if (await users.findByEmailWithPassword(email)) {
      throw new DomainError("Ya existe una cuenta con ese email.");
    }
    // La cuenta de administración da acceso a /admin. Como no se verifica el email al registrarse,
    // quien la crea debe usar el enlace que llega a ese email; así nadie más puede quedarse con ella.
    if (adminEmail && email === normalizeEmail(adminEmail)) {
      if (!input.baseUrl) throw new DomainError("No se pudo enviar el email de confirmación. Intenta más tarde.");
      const user = await users.create(email, UNUSABLE_PASSWORD_HASH);
      await this.sendResetLink(user, input.baseUrl, clock.now());
      return { status: "check-email" };
    }
    const user = await users.create(email, await hasher.hash(input.password));
    return { status: "signed-in", session: await this.startSession(user.id) };
  }

  async login(input: { email: string; password: string }): Promise<Session> {
    const { users, hasher, clock } = this.deps;
    const user = await users.findByEmailWithPassword(normalizeEmail(input.email));
    const now = clock.now();
    if (user?.lockedUntil && user.lockedUntil > now) {
      throw new DomainError(
        `Hubo demasiados intentos fallidos. Espera ${LOGIN_LOCK_MINUTES} minutos o crea una contraseña nueva con "¿Olvidaste tu contraseña?".`,
      );
    }
    if (!user) {
      // Se calcula un hash igual: así la respuesta tarda lo mismo exista o no la cuenta.
      await hasher.verify(input.password, await this.getDummyHash());
      throw new DomainError("Email o contraseña incorrectos.");
    }
    if (!(await hasher.verify(input.password, user.passwordHash))) {
      const failures = await users.incrementFailedLogins(user.id);
      if (failures >= MAX_FAILED_LOGINS) {
        await users.lockLogin(user.id, new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000));
      }
      throw new DomainError("Email o contraseña incorrectos.");
    }
    if (user.failedLogins > 0) await users.clearFailedLogins(user.id);
    return this.startSession(user.id);
  }

  /**
   * Envía un enlace para crear una contraseña nueva. No dice si el email tiene cuenta
   * (para no revelar quién usa la app): si no existe, simplemente no hace nada.
   */
  async requestPasswordReset(input: { email: string; baseUrl: string }): Promise<void> {
    const { users, resets, clock } = this.deps;
    const user = await users.findByEmailWithPassword(normalizeEmail(input.email));
    if (!user) return;
    const now = clock.now();
    const last = await resets.lastCreatedAt(user.id);
    if (last && now.getTime() - last.getTime() < RESET_COOLDOWN_MS) return;
    await this.sendResetLink(user, input.baseUrl, now);
  }

  /** Cambia la contraseña con el enlace recibido, cierra las demás sesiones e inicia una nueva. */
  async resetPassword(input: { token: string; password: string }): Promise<Session> {
    const { users, sessions, resets, hasher, clock } = this.deps;
    // Se valida antes de usar el enlace, para no gastarlo con una contraseña que no sirve.
    validatePassword(input.password);
    const userId = await resets.consume(input.token, clock.now());
    if (!userId) throw new DomainError("El enlace no es válido o ya venció. Pide uno nuevo.");
    await users.setPasswordHash(userId, await hasher.hash(input.password));
    // Quien demuestra que el email es suyo vuelve a poder entrar de inmediato.
    await users.clearFailedLogins(userId);
    await sessions.deleteAllForUser(userId);
    return this.startSession(userId);
  }

  logout(token: string): Promise<void> {
    return this.deps.sessions.delete(token);
  }

  currentUser(token: string): Promise<User | null> {
    return this.deps.sessions.findUser(token, this.deps.clock.now());
  }

  private async startSession(userId: string): Promise<Session> {
    const expiresAt = new Date(this.deps.clock.now().getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const token = await this.deps.sessions.create(userId, expiresAt);
    return { token, expiresAt };
  }

  private async sendResetLink(user: Pick<User, "id" | "email">, baseUrl: string, now: Date): Promise<void> {
    const expiresAt = new Date(now.getTime() + RESET_VALID_MINUTES * 60 * 1000);
    const token = await this.deps.resets.create(user.id, expiresAt, now);
    const link = `${baseUrl.replace(/\/+$/, "")}/restablecer?token=${encodeURIComponent(token)}`;
    await this.deps.notifier.sendPasswordReset(user.email, link, RESET_VALID_MINUTES);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.deps.hasher.hash("contraseña-que-no-se-usa");
    return this.dummyHash;
  }
}

function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new DomainError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
}

/** Compara sin cortar en la primera diferencia, para que el tiempo de respuesta no revele cuánto del código se acertó. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
