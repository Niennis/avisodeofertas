import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import type { PasswordResetRepository } from "@/core/application/ports/password-reset-repository";
import type { SessionRepository } from "@/core/application/ports/session-repository";
import type { UserRepository, UserWithPassword } from "@/core/application/ports/user-repository";
import type { Palette, User } from "@/core/domain/user";
import type { Database } from "./db";
import { passwordResets, sessions, users } from "./schema";

const publicColumns = {
  id: users.id,
  email: users.email,
  emailNotifications: users.emailNotifications,
  palette: users.palette,
  createdAt: users.createdAt,
};

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select(publicColumns).from(users).where(eq(users.id, id));
    return row ?? null;
  }

  async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email));
    return row ?? null;
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const [row] = await this.db.insert(users).values({ email, passwordHash }).returning(publicColumns);
    return row;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  }

  async setEmailNotifications(userId: string, enabled: boolean): Promise<void> {
    await this.db.update(users).set({ emailNotifications: enabled }).where(eq(users.id, userId));
  }

  async setPalette(userId: string, palette: Palette): Promise<void> {
    await this.db.update(users).set({ palette }).where(eq(users.id, userId));
  }
}

/** Sesiones en base de datos. Se guarda solo el hash del token, así una filtración de la tabla no permite entrar. */
export class DrizzleSessionRepository implements SessionRepository {
  constructor(private readonly db: Database) {}

  async create(userId: string, expiresAt: Date): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
    return token;
  }

  async findUser(token: string, now: Date): Promise<User | null> {
    const [row] = await this.db
      .select(publicColumns)
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, now)));
    return row ?? null;
  }

  async delete(token: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }
}

/** Enlaces de recuperación de contraseña; igual que las sesiones, se guarda solo el hash del token. */
export class DrizzlePasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly db: Database) {}

  async create(userId: string, expiresAt: Date, now: Date): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.db.delete(passwordResets).where(eq(passwordResets.userId, userId));
    await this.db.insert(passwordResets).values({ id: hashToken(token), userId, expiresAt, createdAt: now });
    return token;
  }

  async lastCreatedAt(userId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ createdAt: passwordResets.createdAt })
      .from(passwordResets)
      .where(eq(passwordResets.userId, userId))
      .orderBy(desc(passwordResets.createdAt))
      .limit(1);
    return row?.createdAt ?? null;
  }

  async consume(token: string, now: Date): Promise<string | null> {
    const [row] = await this.db
      .delete(passwordResets)
      .where(and(eq(passwordResets.id, hashToken(token)), gt(passwordResets.expiresAt, now)))
      .returning({ userId: passwordResets.userId });
    if (!row) return null;
    await this.db.delete(passwordResets).where(eq(passwordResets.userId, row.userId));
    return row.userId;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
