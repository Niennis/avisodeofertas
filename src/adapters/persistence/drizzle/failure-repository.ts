import { desc, eq, inArray, isNull } from "drizzle-orm";
import type { FailureRepository } from "@/core/application/ports/failure-repository";
import { hostOf, type FailureReport, type NewFailureReport } from "@/core/domain/failures";
import type { Database } from "./db";
import { failureReports } from "./schema";

export class DrizzleFailureRepository implements FailureRepository {
  constructor(private readonly db: Database) {}

  async record(report: NewFailureReport): Promise<void> {
    await this.db.insert(failureReports).values({
      ...report,
      host: hostOf(report.url),
      detail: report.detail?.slice(0, 1000) ?? null,
    });
  }

  listAll(): Promise<FailureReport[]> {
    return this.db.select().from(failureReports).orderBy(desc(failureReports.createdAt));
  }

  listUnnotified(): Promise<FailureReport[]> {
    return this.db
      .select()
      .from(failureReports)
      .where(isNull(failureReports.notifiedAt))
      .orderBy(desc(failureReports.createdAt));
  }

  async markNotified(ids: string[], at: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.db.update(failureReports).set({ notifiedAt: at }).where(inArray(failureReports.id, ids));
  }

  async deleteByHost(host: string): Promise<void> {
    await this.db.delete(failureReports).where(eq(failureReports.host, host));
  }
}
