import Link from "next/link";
import { getContainer } from "@/composition/container";
import { isDemo } from "@/core/domain/user";
import { formatDateTime } from "@/lib/format";
import { logoutAction } from "@/web/actions";
import { PaletteSync } from "@/web/components/palette-sync";
import { ThemeToggle } from "@/web/components/theme-toggle";
import { requireUser } from "@/web/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const { admin, watches } = await getContainer();
  const demo = isDemo(user);
  const remaining = demo ? Math.max(0, user.watchLimit! - (await watches.list(user.id)).length) : 0;
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
          <Link href="/cuenta" className="hover:text-ink" title={demo ? undefined : user.email}>
            Mi cuenta
          </Link>
          <form action={logoutAction}>
            <button className="underline underline-offset-4 hover:text-ink">{demo ? "Salir de la demo" : "Salir"}</button>
          </form>
        </nav>
      </header>
      {demo && (
        <aside aria-label="Cuenta de demostración" className="mb-6 rounded-(--radius-control) bg-target-soft p-4 text-sm">
          <p>
            <strong>Estás en la demo.</strong> Puedes editar y eliminar productos, y{" "}
            {remaining === 0
              ? "ya no puedes agregar más (elimina alguno si quieres probar con otro)"
              : remaining === 1
                ? "agregar 1 producto más"
                : `agregar ${remaining} productos más`}
            . Los emails están desactivados, y la cuenta se borra al salir o el {formatDateTime(user.demoExpiresAt!)}.
          </p>
        </aside>
      )}
      <div id="contenido">{children}</div>
      <PaletteSync palette={user.palette} />
    </div>
  );
}
