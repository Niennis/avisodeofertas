import type { Palette, User } from "@/core/domain/user";

export interface UserWithPassword extends User {
  passwordHash: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
  create(email: string, passwordHash: string): Promise<User>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  setEmailNotifications(userId: string, enabled: boolean): Promise<void>;
  setPalette(userId: string, palette: Palette): Promise<void>;
}
