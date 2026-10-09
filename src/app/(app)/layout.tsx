import Link from "next/link";
import { getContainer } from "@/composition/container";
import { logoutAction } from "@/web/actions";
import { PaletteSync } from "@/web/components/palette-sync";
import { ThemeToggle } from "@/web/components/theme-toggle";
import { requireUser } from "@/web/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const { admin } = await getContainer();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-5">
        <Link href="/" className="font-(family-name:--font-display) font-bold">
          Alerta de ofertas
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted sm:gap-x-4">
          <ThemeToggle />
          {admin.isAdmin(user) && (
            <Link href="/admin" className="hover:text-ink">
              Admin
            </Link>
          )}
          <Link href="/cuenta" className="hover:text-ink" title={user.email}>
            Mi cuenta
          </Link>
          <form action={logoutAction}>
            <button className="underline underline-offset-4 hover:text-ink">Salir</button>
          </form>
        </nav>
      </header>
      <div id="contenido">{children}</div>
      <PaletteSync palette={user.palette} />
    </div>
  );
}
