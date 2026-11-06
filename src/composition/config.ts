import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : null));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "Falta DATABASE_URL (la cadena de conexión de Neon)"),
  APP_URL: optional,
  INVITE_CODE: optional,
  ADMIN_EMAIL: optional,
  CRON_SECRET: optional,
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  MAIL_FROM: optional,
  /** Dominio de producción que Vercel define solo (sin https://). Respaldo si falta APP_URL. */
  VERCEL_PROJECT_PRODUCTION_URL: optional,
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Configuración inválida:\n${problems.join("\n")}`);
  }
  const e = parsed.data;
  const smtp =
    e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS
      ? { host: e.SMTP_HOST, port: e.SMTP_PORT, user: e.SMTP_USER, pass: e.SMTP_PASS, from: e.MAIL_FROM ?? e.SMTP_USER }
      : null;
  return {
    databaseUrl: e.DATABASE_URL,
    // Nunca se toma de los headers de la request en producción: así nadie puede hacer que los enlaces de los emails apunten a otro sitio.
    appUrl: e.APP_URL ?? (e.VERCEL_PROJECT_PRODUCTION_URL ? `https://${e.VERCEL_PROJECT_PRODUCTION_URL}` : null),
    inviteCode: e.INVITE_CODE,
    // Quien administra la app: por defecto, la cuenta que envía los emails.
    adminEmail: e.ADMIN_EMAIL ?? e.SMTP_USER,
    cronSecret: e.CRON_SECRET,
    smtp,
  };
}
