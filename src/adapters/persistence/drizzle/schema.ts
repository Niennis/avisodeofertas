import { sql } from "drizzle-orm";
import { DEFAULT_PALETTE, PALETTES } from "@/core/domain/user";
import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { PriceInsight } from "@/core/domain/price-insight";
import type { RestockTimes } from "@/core/domain/restock";
import type { ProductVariant } from "@/core/domain/variants";

/** Los precios se guardan como `numeric` para no perder decimales en monedas que los usan. */
const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  palette: text("palette", { enum: PALETTES }).notNull().default(DEFAULT_PALETTE),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    /** Hash SHA-256 del token; el token en claro solo vive en la cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Enlaces para crear una contraseña nueva. Como en las sesiones, se guarda solo el hash del token. */
export const passwordResets = pgTable(
  "password_resets",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull().unique(),
  store: text("store").notNull(),
  name: text("name").notNull(),
  brand: text("brand"),
  imageUrl: text("image_url"),
  currency: text("currency").notNull().default("CLP"),
  price: money("price"),
  listPrice: money("list_price"),
  available: boolean("available"),
  /** Colores de la línea con su precio actual; vacío en productos simples. */
  variants: jsonb("variants").$type<ProductVariant[]>().notNull().default([]),
  /** Análisis del historial (¿es el precio más bajo?, ¿la rebaja es real?), recalculado en cada lectura. */
  priceInsight: jsonb("price_insight").$type<PriceInsight>(),
  /** Cuándo volvió a haber stock de cada opción (clave del color, o "" en un producto simple). */
  restocks: jsonb("restocks").$type<RestockTimes>().notNull().default({}),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    price: money("price").notNull(),
    listPrice: money("list_price"),
    available: boolean("available"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index("price_snapshots_product_idx").on(t.productId, t.checkedAt)],
);

/** Grupos de "mismo producto en varias tiendas"; cada usuario arma los suyos. */
export const productGroups = pgTable(
  "product_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_groups_user_idx").on(t.userId)],
);

export const watches = pgTable(
  "watches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    targetPrice: money("target_price"),
    notifyOnSale: boolean("notify_on_sale").notNull().default(true),
    notifyOnRestock: boolean("notify_on_restock").notNull().default(false),
    lastRestockNotifiedAt: timestamp("last_restock_notified_at", { withTimezone: true }),
    lastNotifiedPrice: money("last_notified_price"),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    excludedVariants: jsonb("excluded_variants").$type<string[]>().notNull().default([]),
    groupId: uuid("group_id").references(() => productGroups.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("watches_user_product_idx").on(t.userId, t.productId), index("watches_product_idx").on(t.productId)],
);

/** Enlaces que la app no pudo leer, para que quien administra los revise. */
export const failureReports = pgTable(
  "failure_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    host: text("host").notNull(),
    problem: text("problem", { enum: ["unsupported", "blocked", "unavailable", "not_found"] }).notNull(),
    message: text("message").notNull(),
    detail: text("detail"),
    source: text("source", { enum: ["add", "check"] }).notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [index("failure_reports_host_idx").on(t.host)],
);
