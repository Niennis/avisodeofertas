import { DomainError } from "./errors";

/** Cuántas revisiones de precio al día se pueden elegir, y a qué horas de Chile se hacen. */
export const CHECK_HOURS = {
  1: [9],
  2: [9, 20],
  3: [9, 14, 20],
  4: [9, 13, 17, 21],
} as const satisfies Record<number, readonly number[]>;

export type ChecksPerDay = keyof typeof CHECK_HOURS;
export const CHECKS_PER_DAY_OPTIONS = Object.keys(CHECK_HOURS).map(Number) as ChecksPerDay[];
export const DEFAULT_CHECKS_PER_DAY: ChecksPerDay = 1;
export const CHECK_TIME_ZONE = "America/Santiago";

export interface CheckSchedule {
  checksPerDay: ChecksPerDay;
  /** Última revisión programada que se hizo (no cuenta "Revisar ahora"). */
  lastCheckAt: Date | null;
}

export function parseChecksPerDay(value: unknown): ChecksPerDay {
  const n = Number(value);
  if (!(n in CHECK_HOURS)) throw new DomainError("Elige entre 1 y 4 revisiones al día.");
  return n as ChecksPerDay;
}

/** "09:00", "09:00 y 20:00", "09:00, 14:00 y 20:00"… */
export function describeCheckHours(checksPerDay: ChecksPerDay): string {
  const hours = CHECK_HOURS[checksPerDay].map((h) => `${String(h).padStart(2, "0")}:00`);
  return hours.length === 1 ? hours[0] : `${hours.slice(0, -1).join(", ")} y ${hours.at(-1)}`;
}

/**
 * ¿Toca una revisión programada? Sí, si ya pasó un horario de revisión y desde entonces no se revisó.
 * Así no importa si el aviso del cron llega tarde o se repite: cada horario se revisa una sola vez.
 * Las horas se comparan en hora de Chile, para que el cambio de horario no las mueva.
 */
export function isCheckDue({ checksPerDay, lastCheckAt }: CheckSchedule, now: Date): boolean {
  if (!lastCheckAt) return true;
  const today = chileTime(now);
  const hours = CHECK_HOURS[checksPerDay];
  const passedToday = hours.filter((h) => h <= today.hour);
  const slot =
    passedToday.length > 0
      ? `${today.date} ${pad(passedToday.at(-1)!)}`
      : `${chileTime(new Date(now.getTime() - 24 * 3600_000)).date} ${pad(hours.at(-1)!)}`;
  const last = chileTime(lastCheckAt);
  return `${last.date} ${pad(last.hour)}` < slot;
}

const pad = (hour: number) => String(hour).padStart(2, "0");

const chileFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: CHECK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** Fecha (`AAAA-MM-DD`) y hora (0–23) en Chile. */
function chileTime(date: Date): { date: string; hour: number } {
  const parts = Object.fromEntries(chileFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}
