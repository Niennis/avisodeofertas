import { getContainer } from "@/composition/container";
import { constantTimeEqual } from "@/core/application/use-cases/auth";
import { LONGEST_WINDOW_MS } from "@/web/rate-limit";

// Revisar varias tiendas con pausas entre requests puede tardar más de lo habitual.
export const maxDuration = 300;

/**
 * Lo llama GitHub Actions en las horas en que puede tocar revisar (y Vercel Cron una vez al día, de respaldo).
 * Solo revisa cuando toca según las revisiones al día elegidas en la administración.
 * Vercel envía `Authorization: Bearer <CRON_SECRET>` automáticamente.
 */
export async function GET(request: Request) {
  const container = await getContainer();
  const secret = container.config.cronSecret;
  if (!secret || !constantTimeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  // Limpieza: las cuentas de pedidos por IP más antiguas que la ventana más larga ya no sirven.
  await container.rateLimiter.prune(new Date(container.clock.now().getTime() - LONGEST_WINDOW_MS));
  // Las cuentas demo vencidas se borran, con sus productos de prueba.
  await container.demo.cleanup();
  if (!(await container.schedule.claimIfDue())) {
    return Response.json({ skipped: "Todavía no toca revisar." });
  }
  const result = await container.checkPrices(console.log);
  return Response.json(result);
}
