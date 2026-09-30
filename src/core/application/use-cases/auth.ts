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

export interface AuthDeps {
  users: UserRepository;
  sessions: SessionRepository;
  resets: PasswordResetRepository;
  hasher: PasswordHasher;
  notifier: Notifier;
  clock: Clock;
  /** Si está definido, se exige para crear una cuenta (evita registros de desconocidos). */
  inviteCode: string | null;
}

export interface Session {
  token: string;
  expiresAt: Date;
}

export class AuthService {
  constructor(private readonly deps: AuthDeps) {}

  async register(input: { email: string; password: string; inviteCode: string }): Promise<Session> {
    const { users, hasher, inviteCode } = this.deps;
    if (inviteCode && input.inviteCode.trim() !== inviteCode) {
      throw new DomainError("El código de invitación no es correcto.");
    }
    const email = normalizeEmail(input.email);
    if (!EMAIL_PATTERN.test(email)) throw new DomainError("Ingresa un email válido.");
    validatePassword(input.password);
    if (await users.findByEmailWithPassword(email)) {
      throw new DomainError("Ya existe una cuenta con ese email.");
    }
    const user = await users.create(email, await hasher.hash(input.password));
    return this.startSession(user.id);
  }

  async login(input: { email: string; password: string }): Promise<Session> {
    const user = await this.deps.users.findByEmailWithPassword(normalizeEmail(input.email));
    const valid = user != null && (await this.deps.hasher.verify(input.password, user.passwordHash));
    if (!valid) throw new DomainError("Email o contraseña incorrectos.");
    return this.startSession(user.id);
  }

  /**
   * Envía un enlace para crear una contraseña nueva. No dice si el email tiene cuenta
   * (para no revelar quién usa la app): si no existe, simplemente no hace nada.
   */
  async requestPasswordReset(input: { email: string; baseUrl: string }): Promise<void> {
    const { users, resets, notifier, clock } = this.deps;
    const user = await users.findByEmailWithPassword(normalizeEmail(input.email));
    if (!user) return;
    const now = clock.now();
    const last = await resets.lastCreatedAt(user.id);
    if (last && now.getTime() - last.getTime() < RESET_COOLDOWN_MS) return;
    const expiresAt = new Date(now.getTime() + RESET_VALID_MINUTES * 60 * 1000);
    const token = await resets.create(user.id, expiresAt, now);
    const link = `${input.baseUrl.replace(/\/+$/, "")}/restablecer?token=${encodeURIComponent(token)}`;
    await notifier.sendPasswordReset(user.email, link, RESET_VALID_MINUTES);
  }

  /** Cambia la contraseña con el enlace recibido, cierra las demás sesiones e inicia una nueva. */
  async resetPassword(input: { token: string; password: string }): Promise<Session> {
    const { users, sessions, resets, hasher, clock } = this.deps;
    // Se valida antes de usar el enlace, para no gastarlo con una contraseña que no sirve.
    validatePassword(input.password);
    const userId = await resets.consume(input.token, clock.now());
    if (!userId) throw new DomainError("El enlace no es válido o ya venció. Pide uno nuevo.");
    await users.setPasswordHash(userId, await hasher.hash(input.password));
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
}

function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new DomainError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
}
