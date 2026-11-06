import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNotNull, lte, sql } from "drizzle-orm";
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
  demoExpiresAt: users.demoExpiresAt,
  watchLimit: users.watchLimit,
};

/** Hash que ninguna contraseña cumple: a las cuentas demo no se puede entrar con contraseña. */
const NO_PASSWORD = "sin-contraseña";

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

  async incrementFailedLogins(userId: string): Promise<number> {
    // Se suma en la base de datos para no perder intentos que llegan al mismo tiempo.
    const [row] = await this.db
      .update(users)
      .set({ failedLogins: sql`${users.failedLogins} + 1` })
      .where(eq(users.id, userId))
      .returning({ failedLogins: users.failedLogins });
    return row?.failedLogins ?? 0;
  }

  async lockLogin(userId: string, until: Date): Promise<void> {
    await this.db.update(users).set({ failedLogins: 0, lockedUntil: until }).where(eq(users.id, userId));
  }

  async clearFailedLogins(userId: string): Promise<void> {
    await this.db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, userId));
  }

  async createDemo(input: { email: string; expiresAt: Date; watchLimit: number }): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash: NO_PASSWORD,
        emailNotifications: false,
        demoExpiresAt: input.expiresAt,
        watchLimit: input.watchLimit,
      })
      .returning(publicColumns);
    return row;
  }

  async deleteDemo(userId: string): Promise<void> {
    // La condición evita borrar una cuenta normal por error.
    await this.db.delete(users).where(and(eq(users.id, userId), isNotNull(users.demoExpiresAt)));
  }

  async deleteExpiredDemos(now: Date): Promise<number> {
    const deleted = await this.db
      .delete(users)
      .where(and(isNotNull(users.demoExpiresAt), lte(users.demoExpiresAt, now)))
      .returning({ id: users.id });
    return deleted.length;
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
