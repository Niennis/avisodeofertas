import { redirect } from "next/navigation";
import { currentUser } from "@/web/session";
import { sharedLink } from "@/web/shared-link";

/**
 * Destino del menú "Compartir" del celular (`share_target` en el manifiesto).
 * Lleva el enlace al formulario de la página principal; sin sesión, pasa antes por "Ingresar".
 */
export async function GET(request: Request) {
  const link = sharedLink(Object.fromEntries(new URL(request.url).searchParams));
  const home = link ? `/?url=${encodeURIComponent(link)}` : "/";
  if (!(await currentUser())) redirect(`/ingresar?siguiente=${encodeURIComponent(home)}`);
  redirect(home);
}
