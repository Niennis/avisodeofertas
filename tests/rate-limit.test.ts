import { beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "@/adapters/persistence/drizzle/db";
import { DrizzleRateLimiter } from "@/adapters/persistence/drizzle/rate-limiter";

const MINUTE = 60_000;
const start = new Date("2026-11-06T12:00:00Z");
const at = (minutes: number) => new Date(start.getTime() + minutes * MINUTE);

describe("límite de pedidos por IP (en la base de datos)", () => {
  let limiter: DrizzleRateLimiter;

  beforeEach(async () => {
    limiter = new DrizzleRateLimiter(await createDatabase("pglite:memory"));
  });

  async function hits(key: string, times: number, now: Date) {
    const results: boolean[] = [];
    for (let i = 0; i < times; i++) results.push(await limiter.hit(key, 3, 15 * MINUTE, now));
    return results;
  }

  it("deja pasar hasta el límite y rechaza el siguiente", async () => {
    expect(await hits("ingreso:1.2.3.4", 4, at(0))).toEqual([true, true, true, false]);
  });

  it("cuenta cada IP y cada acción por separado", async () => {
    await hits("ingreso:1.2.3.4", 4, at(0));
    expect(await limiter.hit("ingreso:5.6.7.8", 3, 15 * MINUTE, at(1))).toBe(true);
    expect(await limiter.hit("registro:1.2.3.4", 3, 15 * MINUTE, at(1))).toBe(true);
  });

  it("vuelve a dejar pasar cuando termina la ventana", async () => {
    await hits("ingreso:1.2.3.4", 4, at(0));
    expect(await limiter.hit("ingreso:1.2.3.4", 3, 15 * MINUTE, at(14))).toBe(false);
    expect(await hits("ingreso:1.2.3.4", 4, at(15))).toEqual([true, true, true, false]);
  });

  it("los pedidos simultáneos no se pierden", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => limiter.hit("registro:9.9.9.9", 3, 15 * MINUTE, at(0))));
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  it("la limpieza borra solo las ventanas viejas", async () => {
    await hits("ingreso:viejo", 4, at(0));
    await hits("ingreso:nuevo", 4, at(30));
    await limiter.prune(at(20));
    // La ventana vieja se borró (empieza de cero); la nueva sigue bloqueada.
    expect(await limiter.hit("ingreso:viejo", 3, 15 * MINUTE, at(31))).toBe(true);
    expect(await limiter.hit("ingreso:nuevo", 3, 15 * MINUTE, at(31))).toBe(false);
  });
});
