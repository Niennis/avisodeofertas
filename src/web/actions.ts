"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DomainError } from "@/core/domain/errors";
import type { WatchSettings } from "@/core/domain/watch";
import type { Session } from "@/core/application/use-cases/auth";
import type { AddResolution, AddWatchResult } from "@/core/application/use-cases/watches";
import { getContainer } from "@/composition/container";
import { endSession, requireUser, savePaletteCookie, saveSessionCookie } from "./session";

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
  };
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await run(async () => {
    const { auth } = await getContainer();
    await startSession(
      await auth.register({ email: text(form, "email"), password: text(form, "password"), inviteCode: text(form, "inviteCode") }),
    );
  });
  if (state.error) return state;
  redirect("/");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const state = await run(async () => {
    const { auth } = await getContainer();
    await startSession(await auth.login({ email: text(form, "email"), password: text(form, "password") }));
  });
  if (state.error) return state;
  redirect("/");
}

export async function logoutAction() {
  await endSession();
  redirect("/ingresar");
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
          return { ok: `Listo: ahora sigues ${result.name} con ${colorsText(result.variantCount)} en una sola tarjeta.` };
        }
        if (result.variantCount > 1) return { ok: `Listo. Sigues ${colorsText(result.variantCount)} de ${result.name}.` };
        return {
          ok: user.emailNotifications
            ? "Listo. Te avisaremos por email cuando haya una oferta."
            : "Listo. Verás sus ofertas en esta lista.",
        };
      }
    }
  });
}

function colorsText(count: number): string {
  return count === 1 ? "1 color" : `los ${count} colores`;
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

export async function selectVariantsAction(_: FormState, form: FormData): Promise<FormState> {
  return run(async () => {
    const user = await requireUser();
    const { watches } = await getContainer();
    const keys = form.getAll("variant").map(String);
    await watches.selectVariants(user.id, text(form, "watchId"), keys);
    revalidatePath("/", "layout");
    return { ok: `Listo: sigues ${keys.length === 1 ? "1 color" : `${keys.length} colores`}.` };
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

export async function updateEmailNotificationsAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
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
