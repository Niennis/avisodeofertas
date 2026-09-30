import Link from "next/link";
import { getContainer } from "@/composition/container";
import { AddWatchForm } from "@/web/components/add-watch-form";
import { WatchBrowser } from "@/web/components/watch-browser";
import { requireUser } from "@/web/session";
import { sharedLink } from "@/web/shared-link";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  // Enlace que llegó desde el menú "Compartir" (vía /compartir).
  const shared = sharedLink(await searchParams);
  const { watches, groups } = await getContainer();
  const [list, userGroups] = await Promise.all([watches.list(user.id), groups.list(user.id)]);

  return (
    <main className="flex flex-col gap-10">
      {!user.emailNotifications && (
        <p className="-mb-4 rounded-(--radius-control) bg-target-soft px-4 py-3 text-sm">
          Tienes desactivados los avisos por email: las ofertas solo se muestran aquí.{" "}
          <Link href="/cuenta" className="font-medium underline underline-offset-4">
            Activarlos
          </Link>
        </p>
      )}
      <section className="card p-5">
        <AddWatchForm key={shared} sharedUrl={shared} />
      </section>

      {list.length === 0 ? (
        <p className="text-muted">
          Todavía no sigues productos. Pega arriba el enlace de una lana, un protector solar o lo que quieras, de
          Orquídea, Revés Derecho, Modista, Reginella, Lana Móvil, Con Amor Amor, Cruz Verde, Ahumada, Salcobrand u
          otra tienda en línea.
        </p>
      ) : (
        <WatchBrowser watches={list} groups={userGroups} emailNotifications={user.emailNotifications} />
      )}
    </main>
  );
}
