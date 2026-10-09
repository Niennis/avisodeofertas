import type { CheckSchedule, ChecksPerDay } from "@/core/domain/check-schedule";

export interface CheckScheduleRepository {
  get(): Promise<CheckSchedule>;
  setChecksPerDay(checksPerDay: ChecksPerDay): Promise<void>;
  /**
   * Registra una revisión programada solo si nadie lo hizo desde que se leyó `previous`.
   * Si el cron llama dos veces a la vez, solo una de las llamadas revisa.
   */
  claim(previous: Date | null, at: Date): Promise<boolean>;
}
