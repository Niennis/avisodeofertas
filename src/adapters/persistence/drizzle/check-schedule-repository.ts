import { and, eq, isNull } from "drizzle-orm";
import type { CheckScheduleRepository } from "@/core/application/ports/check-schedule-repository";
import { DEFAULT_CHECKS_PER_DAY, parseChecksPerDay, type CheckSchedule, type ChecksPerDay } from "@/core/domain/check-schedule";
import type { Database } from "./db";
import { checkSchedule } from "./schema";

/** La configuración vive en una sola fila (`id = 1`), creada por la migración. */
const ROW = eq(checkSchedule.id, 1);

export class DrizzleCheckScheduleRepository implements CheckScheduleRepository {
  constructor(private readonly db: Database) {}

  async get(): Promise<CheckSchedule> {
    const [row] = await this.db.select().from(checkSchedule).where(ROW);
    if (!row) return { checksPerDay: DEFAULT_CHECKS_PER_DAY, lastCheckAt: null };
    return { checksPerDay: parseChecksPerDay(row.checksPerDay), lastCheckAt: row.lastCheckAt };
  }

  async setChecksPerDay(checksPerDay: ChecksPerDay): Promise<void> {
    await this.db
      .insert(checkSchedule)
      .values({ id: 1, checksPerDay })
      .onConflictDoUpdate({ target: checkSchedule.id, set: { checksPerDay } });
  }

  async claim(previous: Date | null, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(checkSchedule)
      .set({ lastCheckAt: at })
      .where(and(ROW, previous ? eq(checkSchedule.lastCheckAt, previous) : isNull(checkSchedule.lastCheckAt)))
      .returning({ id: checkSchedule.id });
    return rows.length > 0;
  }
}
