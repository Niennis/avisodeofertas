import { DomainError } from "@/core/domain/errors";
import { normalizeEmail, type User } from "@/core/domain/user";
import type { Clock } from "../ports/clock";
import type { PasswordHasher } from "../ports/password-hasher";
import type { SessionRepository } from "../ports/session-repository";
import type { UserRepository } from "../ports/user-repository";

const SESSION_DAYS = 30;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthDeps {
  users: UserRepository;
  sessions: SessionRepository;
  hasher: PasswordHasher;
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
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new DomainError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    if (await users.findByEmailWithPassword(email)) {
      throw new DomainError("Ya existe una cuenta con ese email.");
    }
    const user = await users.create(email, await hasher.hash(input.password));
    return this.startSession(user);
  }

  async login(input: { email: string; password: string }): Promise<Session> {
    const user = await this.deps.users.findByEmailWithPassword(normalizeEmail(input.email));
    const valid = user != null && (await this.deps.hasher.verify(input.password, user.passwordHash));
    if (!valid) throw new DomainError("Email o contraseña incorrectos.");
    return this.startSession(user);
  }

  logout(token: string): Promise<void> {
    return this.deps.sessions.delete(token);
  }

  currentUser(token: string): Promise<User | null> {
    return this.deps.sessions.findUser(token, this.deps.clock.now());
  }

  private async startSession(user: User): Promise<Session> {
    const expiresAt = new Date(this.deps.clock.now().getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const token = await this.deps.sessions.create(user.id, expiresAt);
    return { token, expiresAt };
  }
}
