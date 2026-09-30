import Link from "next/link";
import { notFound } from "next/navigation";
import { getContainer } from "@/composition/container";
import { PROBLEM_LABELS } from "@/core/domain/failures";
import { formatDateTime } from "@/lib/format";
import { resolveStoreAction } from "@/web/actions";
import { requireUser } from "@/web/session";

export default async function AdminPage() {
  const user = await requireUser();
  const { admin } = await getContainer();
  // A cualquier otra cuenta se le responde "no encontrado", sin revelar que la página existe.
  if (!admin.isAdmin(user)) notFound();
  const stores = await admin.failuresByStore();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ‹ Mis productos
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Tiendas con problemas</h1>
        <p className="mt-1 text-sm text-muted">
          Enlaces que la app no pudo leer, al agregarlos o en dos revisiones seguidas. Con el último enlace de cada
          tienda se puede agregar un lector para ella. Recibes un resumen por email cuando aparecen fallos nuevos.
        </p>
      </div>

      {stores.length === 0 ? (
        <p className="card p-5 text-muted">No hay fallos pendientes. Todo lo que se agregó se pudo leer.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {stores.map((store) => (
            <li key={store.host} className="card flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold">{store.host}</h2>
                <span className="text-sm text-muted">
                  {store.count} {store.count === 1 ? "vez" : "veces"} · último {formatDateTime(store.lastAt)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {store.problems.map((problem) => (
                  <span key={problem} className="rounded-full bg-sale-soft px-2.5 py-0.5 text-xs font-medium text-sale">
                    {PROBLEM_LABELS[problem]}
                  </span>
                ))}
                <span className="rounded-full bg-line/60 px-2.5 py-0.5 text-xs text-muted">
                  {store.fromAdds > 0 && `${store.fromAdds} al agregar`}
                  {store.fromAdds > 0 && store.fromChecks > 0 && " · "}
                  {store.fromChecks > 0 && `${store.fromChecks} en revisiones`}
                </span>
              </div>
              <a
                href={store.lastUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm break-all underline underline-offset-4"
              >
                {store.lastUrl}
              </a>
              {store.lastDetail && <p className="text-xs text-muted">Detalle técnico: {store.lastDetail}</p>}
              <form action={resolveStoreAction}>
                <input type="hidden" name="host" value={store.host} />
                <button className="btn btn-quiet px-3.5! py-1.5! text-sm">Marcar como resuelta</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
