import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Session } from "@/core/application/use-cases/auth";
import type { Palette, User } from "@/core/domain/user";
import { getContainer } from "@/composition/container";
import { PALETTE_COOKIE } from "./theme";

const COOKIE = "sesion";

/** Usuario de la sesión actual; se calcula una vez por request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const { auth } = await getContainer();
  return auth.currentUser(token);
});

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/ingresar");
  return user;
}

export async function saveSessionCookie(session: Session) {
  (await cookies()).set(COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
}

/** Copia la paleta a una cookie legible por el script del <head>, para aplicarla sin parpadeo. */
export async function savePaletteCookie(palette: Palette) {
  (await cookies()).set(PALETTE_COOKIE, palette, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await (await getContainer()).auth.logout(token);
  store.delete(COOKIE);
}
