import { getContainer } from "@/composition/container";

// Revisar varias tiendas con pausas entre requests puede tardar más de lo habitual.
export const maxDuration = 300;

/**
 * Lo llama GitHub Actions cada hora (y Vercel Cron una vez al día, de respaldo).
 * Solo revisa cuando toca según las revisiones al día elegidas en la administración.
 * Vercel envía `Authorization: Bearer <CRON_SECRET>` automáticamente.
 */
export async function GET(request: Request) {
  const container = await getContainer();
  const secret = container.config.cronSecret;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!(await container.schedule.claimIfDue())) {
    return Response.json({ skipped: "Todavía no toca revisar." });
  }
  const result = await container.checkPrices(console.log);
  return Response.json(result);
}
