import Link from "next/link";
import { notFound } from "next/navigation";
import { getContainer } from "@/composition/container";
import { NotFoundError } from "@/core/domain/errors";
import { groupBest, sortMembersByPrice } from "@/core/domain/group";
import { watchSummary } from "@/core/domain/watch";
import { removeFromGroupAction, ungroupAction } from "@/web/actions";
import { GroupNameForm } from "@/web/components/group-name-form";
import { PriceTag } from "@/web/components/price-tag";
import { StoreAdder } from "@/web/components/store-adder";
import { groupCandidates } from "@/web/group-candidates";
import { requireUser } from "@/web/session";

async function loadGroup(userId: string, groupId: string) {
  const { groups } = await getContainer();
  try {
    return await groups.detail(userId, groupId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export default async function GroupPage({ params }: PageProps<"/grupos/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const group = await loadGroup(user.id, id);
  const { watches, groups } = await getContainer();
  const [allWatches, allGroups] = await Promise.all([watches.list(user.id), groups.list(user.id)]);
  const best = groupBest(group.members);
  const members = sortMembersByPrice(group.members);
  const imageUrl = best?.watch.product.imageUrl ?? members.find((m) => m.product.imageUrl)?.product.imageUrl;
  const brand = members.find((m) => m.product.brand)?.product.brand;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ‹ Mis productos
      </Link>

      <section className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- imágenes de muchas tiendas distintas
          <img src={imageUrl} alt="" className="size-32 shrink-0 rounded-(--radius-control) bg-white object-contain p-2" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <p className="text-sm text-muted">
              {brand ? `${brand} · ` : ""}
              {members.length} tiendas
            </p>
            <h1 className="text-2xl font-bold text-balance">{group.name}</h1>
          </div>
          {best && (
            <div className="flex flex-wrap items-center gap-3">
              <PriceTag
                price={best.summary.price}
                listPrice={best.summary.listPrice}
                currency={best.watch.product.currency}
                size="lg"
              />
              <span className="text-sm text-muted">Mejor precio en {best.watch.product.store}</span>
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Comparación por tienda</h2>
        <ul className="card divide-y divide-line">
          {members.map((member) => {
            const summary = watchSummary(member);
            const isBest = member.id === best?.watch.id;
            return (
              <li key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {member.product.store}
                    {isBest && (
                      <span className="ml-2 rounded-full bg-sale-soft px-2 py-0.5 text-xs text-sale">Más barato</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted" title={member.product.name}>
                    {member.product.name}
                  </p>
                  {member.product.lastError ? (
                    <p className="text-xs text-danger">No se pudo revisar</p>
                  ) : (
                    summary?.available === false && <p className="text-xs text-muted">Agotado</p>
                  )}
                </div>
                <PriceTag
                  price={summary?.price ?? null}
                  listPrice={summary?.listPrice ?? null}
                  currency={member.product.currency}
                  size="sm"
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <a
                    href={member.product.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline underline-offset-4"
                  >
                    Ver en la tienda
                  </a>
                  <Link href={`/productos/${member.id}`} className="text-muted underline underline-offset-4 hover:text-ink">
                    Ver más
                  </Link>
                  <form action={removeFromGroupAction}>
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="watchId" value={member.id} />
                    <button className="text-muted underline underline-offset-4 hover:text-danger">Quitar</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted">
          Los avisos siguen funcionando por tienda. En “Ver más” están el historial y las condiciones de aviso de cada
          una; “Quitar” la saca del grupo sin dejar de seguirla.
        </p>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-bold">Más opciones</h2>
        <StoreAdder
          anchorWatchId={members[0].id}
          candidates={groupCandidates(allWatches, allGroups, { watchId: members[0].id, groupId: group.id })}
        />
      </section>

      <section className="card p-5">
        <GroupNameForm groupId={group.id} name={group.name} />
      </section>

      <form action={ungroupAction} className="border-t border-line pt-6">
        <input type="hidden" name="groupId" value={group.id} />
        <button className="btn btn-quiet">Desagrupar</button>
        <p className="mt-2 text-xs text-muted">Cada tienda vuelve a ser una tarjeta propia; las sigues igual.</p>
      </form>
    </main>
  );
}
