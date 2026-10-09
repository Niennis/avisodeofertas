import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DrizzleCheckScheduleRepository } from "@/adapters/persistence/drizzle/check-schedule-repository";
import { createDatabase } from "@/adapters/persistence/drizzle/db";
import { CheckScheduleService } from "@/core/application/use-cases/check-schedule";
import { CHECK_HOURS, describeCheckHours, isCheckDue } from "@/core/domain/check-schedule";

// Chile en horario de verano es UTC-3 (enero) y en invierno UTC-4 (julio).
const summer = (hhmm: string, day = 15) => new Date(`2027-01-${day}T${hhmm}:00-03:00`);
const winter = (hhmm: string, day = 15) => new Date(`2027-07-${day}T${hhmm}:00-04:00`);

describe("isCheckDue", () => {
  it("una vez al día: toca desde las 09:00 si no se ha revisado hoy", () => {
    const last = summer("09:05", 14);
    expect(isCheckDue({ checksPerDay: 1, lastCheckAt: last }, summer("08:59"))).toBe(false);
    expect(isCheckDue({ checksPerDay: 1, lastCheckAt: last }, summer("09:05"))).toBe(true);
    expect(isCheckDue({ checksPerDay: 1, lastCheckAt: summer("09:05") }, summer("20:05"))).toBe(false);
  });

  it("usa la hora de Chile también en invierno", () => {
    expect(isCheckDue({ checksPerDay: 1, lastCheckAt: winter("09:05", 14) }, winter("08:30"))).toBe(false);
    expect(isCheckDue({ checksPerDay: 1, lastCheckAt: winter("09:05", 14) }, winter("09:10"))).toBe(true);
  });

  it("si una llamada se atrasa o se pierde, la siguiente hace la revisión pendiente", () => {
    expect(isCheckDue({ checksPerDay: 1, lastCheckAt: summer("09:05", 14) }, summer("13:05"))).toBe(true);
  });

  it("dos veces al día: la de las 20:00 queda pendiente hasta la mañana siguiente", () => {
    const after9 = { checksPerDay: 2 as const, lastCheckAt: summer("09:05") };
    expect(isCheckDue(after9, summer("19:05"))).toBe(false);
    expect(isCheckDue(after9, summer("20:05"))).toBe(true);
    expect(isCheckDue({ checksPerDay: 2, lastCheckAt: summer("09:05", 14) }, summer("01:05"))).toBe(true);
  });

  it("sin revisiones anteriores, toca", () => {
    expect(isCheckDue({ checksPerDay: 1, lastCheckAt: null }, summer("03:00"))).toBe(true);
  });
});

describe("describeCheckHours", () => {
  it.each([
    [1, "09:00"],
    [2, "09:00 y 20:00"],
    [3, "09:00, 14:00 y 20:00"],
  ] as const)("%s → %s", (n, text) => {
    expect(describeCheckHours(n)).toBe(text);
  });
});

describe("CheckScheduleService", () => {
  async function setup(now: Date) {
    const clock = { now: () => now };
    const repo = new DrizzleCheckScheduleRepository(await createDatabase("pglite:memory"));
    return { repo, clock, service: new CheckScheduleService(repo, clock) };
  }

  it("parte con una revisión al día y sin revisar hasta el próximo horario", async () => {
    const { service } = await setup(new Date());
    expect((await service.get()).checksPerDay).toBe(1);
    expect(await service.claimIfDue()).toBe(false);
  });

  it("reserva cada horario una sola vez, aunque el cron llame dos veces a la vez", async () => {
    const { repo, clock, service } = await setup(new Date());
    const before = await repo.get();
    clock.now = () => new Date(before.lastCheckAt!.getTime() + 25 * 3600_000);
    const results = await Promise.all([service.claimIfDue(), service.claimIfDue()]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await service.claimIfDue()).toBe(false);
  });

  it("guarda las revisiones al día y rechaza valores fuera de rango", async () => {
    const { service } = await setup(new Date());
    await service.setChecksPerDay("3");
    expect((await service.get()).checksPerDay).toBe(3);
    await expect(service.setChecksPerDay("7")).rejects.toThrow("Elige entre 1 y 4");
  });
});

describe("workflow de GitHub Actions", () => {
  it("el workflow llama en todos los horarios de revisión", () => {
    const workflow = readFileSync(".github/workflows/revisar-precios.yml", "utf-8");
    const hours = /cron: "\d+ ([\d,]+) \* \* \*"/.exec(workflow)![1].split(",").map(Number);
    // Chile está en UTC-3 en verano y en UTC-4 en invierno.
    const needed = Object.values(CHECK_HOURS).flatMap((slots) => slots.flatMap((h) => [(h + 3) % 24, (h + 4) % 24]));
    expect(hours).toEqual(expect.arrayContaining([...new Set(needed)]));
  });
});
