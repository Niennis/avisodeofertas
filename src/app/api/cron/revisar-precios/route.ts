import { getContainer } from "@/composition/container";

// Revisar varias tiendas con pausas entre requests puede tardar más de lo habitual.
export const maxDuration = 300;

/**
 * Lo llama Vercel Cron (o GitHub Actions) una o dos veces al día.
 * Vercel envía `Authorization: Bearer <CRON_SECRET>` automáticamente.
 */
export async function GET(request: Request) {
  const container = await getContainer();
  const secret = container.config.cronSecret;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  const result = await container.checkPrices(console.log);
  return Response.json(result);
}
