"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { DomainError } from "@/core/domain/errors";
import { isDemo } from "@/core/domain/user";
import type { WatchSettings } from "@/core/domain/watch";
import type { Session } from "@/core/application/use-cases/auth";
import type { AddResolution, AddWatchResult } from "@/core/application/use-cases/watches";
import { getContainer } from "@/composition/container";
import { enforceRateLimit } from "./rate-limit";
import { currentUser, endSession, requireUser, savePaletteCookie, saveSessionCookie } from "./session";
import { safeNextPath } from "./shared-link";

export interface FormState {
  error?: string;
  ok?: string;
  /** El enlace choca con una línea o colores que ya sigue; la persona debe elegir qué hacer. */
  conflict?: AddConflict;
}

export type AddConflict = Extract<AddWatchResult, { status: "color-in-line" | "line-has-colors" }>;

const RESOLUTIONS: AddResolution[] = ["separate", "include-in-line", "line-all", "line-only-mine"];

/** Convierte errores de negocio en mensajes para el formulario; el resto se relanza. */
async function run(action: () => Promise<FormState | void>): Promise<FormState> {
  try {
    return (await action()) ?? {};
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
}

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

/** Inicia la sesión y aplica en este navegador la paleta guardada en la cuenta. */
async function startSession(session: Session) {
  await saveSessionCookie(session);
  const user = await (await getContainer()).auth.currentUser(session.token);
  if (user) await savePaletteCookie(user.palette);
}

function readSettings(form: FormData): WatchSettings {
  const raw = text(form, "targetPrice").replace(/[^\d]/g, "");
  return {
    targetPrice: raw ? Number(raw) : null,
    notifyOnSale: form.get("notifyOnSale") === "on",
    notifyOnRestock: form.get("notifyOnRestock") === "on",
  };
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await run(async () => {
    await enforceRateLimit("registro");
    const { auth } = await getContainer();
    const result = await auth.register({
      email: text(form, "email"),
      password: text(form, "password"),
      inviteCode: text(form, "inviteCode"),
      baseUrl: await publicBaseUrl(),
    });
    if (result.status === "check-email") {
      return {
        ok: "Te enviamos un email con un enlace para crear tu contraseña y entrar. Revisa también la carpeta de spam.",
      };
    }
    await startSession(result.session);
  });
  if (state.error || state.ok) return state;
  redirect("/");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await run(async () => {
    // Además del bloqueo por cuenta (en AuthService): frena a quien prueba muchas cuentas distintas.
    await enforceRateLimit("ingreso");
    const { auth } = await getContainer();
    await startSession(await auth.login({ email: text(form, "email"), password: text(form, "password") }));
  });
  if (state.error) return state;
  redirect(safeNextPath(form.get("siguiente")) ?? "/");
}

/**
 * Dirección pública de la app para armar enlaces: `APP_URL` (o el dominio de producción de Vercel).
 * Solo en desarrollo se usa la de esta misma request: en producción esos headers los puede inventar
 * quien hace la request, y el enlace de recuperación terminaría apuntando a su sitio.
 */
async function publicBaseUrl(): Promise<string | null> {
  const { config } = await getContainer();
  if (config.appUrl) return config.appUrl;
  if (process.env.NODE_ENV === "production") {
    console.error("Falta APP_URL: no se pueden armar enlaces para los emails.");
    return null;
  }
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  return `http://${host}`;
}

export async function requestPasswordResetAction(_: FormState, form: FormData): Promise<FormState> {
  const limited = await run(() => enforceRateLimit("recuperar"));
  if (limited.error) return limited;
  const email = text(form, "email");
  const baseUrl = await publicBaseUrl();
  const { auth } = await getContainer();
  // Se envía después de responder: así la respuesta tarda lo mismo exista o no la cuenta.
  if (baseUrl) {
    after(() => auth.requestPasswordReset({ email, baseUrl }).catch((error) => console.error("No se pudo enviar el enlace de recuperación", error)));
  }
  return {
    ok: "Si hay una cuenta con ese email, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.",
  };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await run(async () => {
    const { auth } = await getContainer();
    await startSession(await auth.resetPassword({ token: text(form, "token"), password: text(form, "password") }));
  });
  if (state.error) return state;
  redirect("/");
}

export async function logoutAction() {
  const user = await currentUser();
  await endSession();
  // A una cuenta demo no se puede volver a entrar: se borra al salir.
  if (user && isDemo(user)) await (await getContainer()).demo.end(user.id);
  redirect("/ingresar");
}

/** "Probar la demo": crea una cuenta temporal con productos de ejemplo y entra con ella. */
export async function startDemoAction(): Promise<FormState> {
  const state = await run(async () => {
    await enforceRateLimit("demo");
    const { demo } = await getContainer();
    await startSession(await demo.start());
  });
  if (state.error) return state;
  redirect("/");
}

export async function addWatchAction(_: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await requireUser();
    const { watches } = await getContainer();
    const resolution = RESOLUTIONS.find((r) => r === form.get("resolution"));
    const result = await watches.add(user.id, text(form, "url"), readSettings(form), resolution);

    switch (result.status) {
      case "color-in-line":
      case "line-has-colors":
        return { conflict: result };
      case "included-in-line":
        revalidatePath("/", "layout");
        return { ok: `Listo: marcamos ${result.colorName} en la línea ${result.name}.` };
      case "added": {
        revalidatePath("/", "layout");
        if (result.replaced > 0) {
          return { ok: `Listo: ahora sigues ${result.name} con ${variantsCountText(result.variantCount)} en una sola tarjeta.` };
        }
        if (result.variantCount > 1) return { ok: `Listo. Sigues ${variantsCountText(result.variantCount)} de ${result.name}.` };
        return {
          ok: user.emailNotifications
            ? "Listo. Te avisaremos por email cuando haya una oferta."
            : "Listo. Verás sus ofertas en esta lista.",
        };
      }
    }
  });
}

/** "Variante" y no "color": según la tienda pueden ser colores, tallas, medidas, etc. */
function variantsCountText(count: number): string {
  return count === 1 ? "1 variante" : `las ${count} variantes`;
}

export async function updateWatchAction(_: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await requireUser();
    const { watches } = await getContainer();
    await watches.update(user.id, text(form, "watchId"), readSettings(form));
    revalidatePath("/", "layout");
    return { ok: "Cambios guardados." };
  });
}

/** "Actualizar precio" en la ficha de un producto. */
export async function refreshWatchAction(_: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await requireUser();
    const { watches } = await getContainer();
    const result = await watches.refresh(user.id, text(form, "watchId"));
    if (result === "recent") return { ok: "Se revisó hace un momento; ese es el precio actual." };
    revalidatePath("/", "layout");
    return { ok: "Precio actualizado." };
  });
}

export async function selectVariantsAction(_: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await requireUser();
    const { watches } = await getContainer();
    const keys = form.getAll("variant").map(String);
    await watches.selectVariants(user.id, text(form, "watchId"), keys);
    revalidatePath("/", "layout");
    return { ok: `Listo: sigues ${keys.length === 1 ? "1 variante" : `${keys.length} variantes`}.` };
  });
}

/** "Agregar otra tienda": sigue el enlace y lo junta con el producto de origen. */
export async function addStoreAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await run(async () => {
    const user = await requireUser();
    const { groups } = await getContainer();
    const { groupId } = await groups.addStore(user.id, text(form, "anchorWatchId"), text(form, "url"));
    revalidatePath("/", "layout");
    return { ok: groupId };
  });
  if (state.error) return state;
  redirect(`/grupos/${state.ok}`);
}

/** Junta el producto de origen con otro que ya sigue (o con su grupo). */
export async function groupWithAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await run(async () => {
    const user = await requireUser();
    const { groups } = await getContainer();
    const groupId = await groups.group(user.id, [text(form, "anchorWatchId"), text(form, "otherWatchId")]);
    revalidatePath("/", "layout");
    return { ok: groupId };
  });
  if (state.error) return state;
  redirect(`/grupos/${state.ok}`);
}

export async function renameGroupAction(_: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await requireUser();
    const { groups } = await getContainer();
    await groups.rename(user.id, text(form, "groupId"), text(form, "name"));
    revalidatePath("/", "layout");
    return { ok: "Nombre guardado." };
  });
}

export async function removeFromGroupAction(form: FormData) {
  const user = await requireUser();
  const { groups } = await getContainer();
  const groupId = text(form, "groupId");
  const stillGrouped = await groups.removeMember(user.id, groupId, text(form, "watchId"));
  revalidatePath("/", "layout");
  if (!stillGrouped) redirect("/");
}

export async function ungroupAction(form: FormData) {
  const user = await requireUser();
  const { groups } = await getContainer();
  await groups.ungroup(user.id, text(form, "groupId"));
  revalidatePath("/", "layout");
  redirect("/");
}

/** Administración: da por resueltos los fallos de una tienda. */
export async function resolveStoreAction(form: FormData) {
  const user = await requireUser();
  const { admin } = await getContainer();
  if (!admin.isAdmin(user)) return;
  await admin.resolveStore(text(form, "host"));
  revalidatePath("/admin");
}

/** Administración: "Revisar ahora" hace la misma revisión que el cron, incluidos los avisos por email. */
export async function checkAllPricesAction(): Promise<FormState> {
  const user = await requireUser();
  const container = await getContainer();
  if (!container.admin.isAdmin(user)) return { error: "No autorizado." };
  const result = await container.checkPrices(console.log);
  revalidatePath("/", "layout");
  const parts = [`${result.checked} ${result.checked === 1 ? "producto revisado" : "productos revisados"}`];
  if (result.failed.length > 0) parts.push(`${result.failed.length} con error`);
  parts.push(result.emailsSent === 0 ? "sin avisos nuevos" : `${result.emailsSent} ${result.emailsSent === 1 ? "email enviado" : "emails enviados"}`);
  return { ok: `Listo: ${parts.join(", ")}.` };
}

/** Administración: cuántas veces al día se revisan los precios. */
export async function updateChecksPerDayAction(_: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await requireUser();
    const container = await getContainer();
    if (!container.admin.isAdmin(user)) return { error: "No autorizado." };
    await container.schedule.setChecksPerDay(form.get("checksPerDay"));
    revalidatePath("/", "layout");
    return { ok: "Guardado." };
  });
}

export async function updateEmailNotificationsAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (isDemo(user)) return { error: "En la demo los emails están desactivados." };
  const enabled = form.get("emailNotifications") === "on";
  const { account } = await getContainer();
  await account.setEmailNotifications(user.id, enabled);
  revalidatePath("/", "layout");
  return { ok: enabled ? "Recibirás un email cuando haya ofertas." : "Ya no recibirás emails." };
}

export async function updatePaletteAction(palette: string): Promise<FormState> {
  return run(async () => {
    const user = await requireUser();
    const { account } = await getContainer();
    await account.setPalette(user.id, palette);
    await savePaletteCookie(palette as typeof user.palette);
    return { ok: "Guardado." };
  });
}

export async function removeWatchAction(form: FormData) {
  const user = await requireUser();
  const { watches } = await getContainer();
  await watches.remove(user.id, text(form, "watchId"));
  revalidatePath("/");
  redirect("/");
}
