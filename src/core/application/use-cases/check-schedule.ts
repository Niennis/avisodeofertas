import { isCheckDue, parseChecksPerDay, type CheckSchedule } from "@/core/domain/check-schedule";
import type { CheckScheduleRepository } from "../ports/check-schedule-repository";
import type { Clock } from "../ports/clock";

/** Cuántas veces al día se revisan los precios. El cron llama varias veces al día y aquí se decide si toca. */
export class CheckScheduleService {
  constructor(
    private readonly schedule: CheckScheduleRepository,
    private readonly clock: Clock,
  ) {}

  get(): Promise<CheckSchedule> {
    return this.schedule.get();
  }

  async setChecksPerDay(value: unknown): Promise<void> {
    await this.schedule.setChecksPerDay(parseChecksPerDay(value));
  }

  /** Para el cron: si toca revisar, reserva el horario y devuelve `true`. */
  async claimIfDue(): Promise<boolean> {
    const current = await this.schedule.get();
    const now = this.clock.now();
    if (!isCheckDue(current, now)) return false;
    return this.schedule.claim(current.lastCheckAt, now);
  }
}
