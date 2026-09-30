import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { SessionRepository } from "@/core/application/ports/session-repository";
import type { UserRepository, UserWithPassword } from "@/core/application/ports/user-repository";
import type { Palette, User } from "@/core/domain/user";
import type { Database } from "./db";
import { sessions, users } from "./schema";

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
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
