import type { FailureReport, NewFailureReport } from "@/core/domain/failures";

export interface FailureRepository {
  record(report: NewFailureReport): Promise<void>;
  listAll(): Promise<FailureReport[]>;
  /** Fallos que todavía no se informaron por email. */
  listUnnotified(): Promise<FailureReport[]>;
  markNotified(ids: string[], at: Date): Promise<void>;
  /** "Ya lo resolví": borra los fallos de una tienda. */
  deleteByHost(host: string): Promise<void>;
}
