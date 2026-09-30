import Link from "next/link";
import { notFound } from "next/navigation";
import { getContainer } from "@/composition/container";
import { NotFoundError } from "@/core/domain/errors";
import { includedVariants } from "@/core/domain/variants";
import { watchSummary } from "@/core/domain/watch";
import { formatDateTime } from "@/lib/format";
import { removeWatchAction } from "@/web/actions";
import { PriceChart } from "@/web/components/price-chart";
import { PriceTag } from "@/web/components/price-tag";
import { RefreshPriceButton } from "@/web/components/price-refresh";
import { StoreAdder } from "@/web/components/store-adder";
import { VariantPicker } from "@/web/components/variant-picker";
import { groupCandidates } from "@/web/group-candidates";
import { WatchSettingsForm } from "@/web/components/watch-settings-form";
import { requireUser } from "@/web/session";

async function loadDetail(userId: string, watchId: string) {
  const { watches } = await getContainer();
  try {
    return await watches.detail(userId, watchId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export default async function ProductPage({ params }: PageProps<"/productos/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const { watch, history } = await loadDetail(user.id, id);
  const { product } = watch;
  const summary = watchSummary(watch);
  const included = includedVariants(product.variants, watch.excludedVariants);
  const isLine = product.variants.length > 1;
  const { watches, groups } = await getContainer();
  const [allWatches, allGroups] = await Promise.all([watches.list(user.id), groups.list(user.id)]);
  const group = allGroups.find((g) => g.id === watch.groupId);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ‹ Mis productos
      </Link>

      <section className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- imágenes de muchas tiendas distintas
          <img src={product.imageUrl} alt="" className="size-32 shrink-0 rounded-(--radius-control) bg-white object-contain p-2" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <p className="text-sm text-muted">
              {product.store}
              {product.brand && ` · ${product.brand}`}
            </p>
            <h1 className="text-2xl font-bold text-balance">{product.name}</h1>
          </div>
          <div>
            <PriceTag
              price={summary?.price ?? null}
              listPrice={summary?.listPrice ?? null}
              currency={product.currency}
              size="lg"
              from={new Set(included.map((v) => v.price)).size > 1}
            />
          </div>
          <p className="text-sm text-muted">
            {summary?.available === false && "Agotado · "}
            {product.lastCheckedAt && `Revisado ${formatDateTime(product.lastCheckedAt)} · `}
            <a href={product.url} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-4">
              Ver en la tienda
            </a>
          </p>
          {product.lastError && <p className="text-sm text-danger">Última revisión con error: {product.lastError}</p>}
          <RefreshPriceButton watchId={watch.id} />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-bold">Historial de precio</h2>
        {isLine && (
          <p className="-mt-2 mb-4 text-sm text-muted">
            Muestra el precio destacado de la línea: el color rebajado más barato o, si no hay rebajas, el más barato.
          </p>
        )}
        <PriceChart history={history} currency={product.currency} targetPrice={watch.targetPrice} />
      </section>

      {isLine && (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold">
            Colores <span className="font-normal text-muted">({included.length} de {product.variants.length})</span>
          </h2>
          <VariantPicker
            watchId={watch.id}
            variants={product.variants}
            excluded={watch.excludedVariants}
            currency={product.currency}
          />
        </section>
      )}

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="font-bold">Mismo producto en otras tiendas</h2>
        {group ? (
          <p className="text-sm">
            Es parte del grupo{" "}
            <Link href={`/grupos/${group.id}`} className="font-medium underline underline-offset-4">
              {group.name}
            </Link>
            , donde puedes comparar precios y agregar más tiendas.
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted">
              Agrega el mismo producto de otras tiendas para verlos en una sola tarjeta y saber dónde está más barato.
            </p>
            <StoreAdder
              anchorWatchId={watch.id}
              candidates={groupCandidates(allWatches, allGroups, { watchId: watch.id, groupId: null })}
            />
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Cuándo avisarme</h2>
        <WatchSettingsForm watchId={watch.id} notifyOnSale={watch.notifyOnSale} targetPrice={watch.targetPrice} />
      </section>

      <form action={removeWatchAction} className="border-t border-line pt-6">
        <input type="hidden" name="watchId" value={watch.id} />
        <button className="btn btn-quiet text-danger">Dejar de seguir este producto</button>
      </form>
    </main>
  );
}
