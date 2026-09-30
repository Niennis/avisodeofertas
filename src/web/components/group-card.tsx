import Link from "next/link";
import { groupBest, type ProductGroup } from "@/core/domain/group";
import type { WatchWithProduct } from "@/core/domain/watch";
import { isWatchDeal } from "../watch-filters";
import { PriceTag } from "./price-tag";

/** Tarjeta de un grupo de "mismo producto en varias tiendas": muestra la mejor opción. */
export function GroupCard({ group, members }: { group: ProductGroup; members: WatchWithProduct[] }) {
  const best = groupBest(members);
  const imageUrl = best?.watch.product.imageUrl ?? members.find((m) => m.product.imageUrl)?.product.imageUrl;
  const stores = [...new Set(members.map((m) => m.product.store))];
  const deals = members.filter(isWatchDeal).length;
  const hasErrors = members.some((m) => m.product.lastError);

  return (
    <li>
      <article className="card relative flex h-full flex-col overflow-hidden transition-colors hover:border-ink has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ink">
        <div className={`relative aspect-square ${imageUrl ? "bg-white" : "bg-line/40"}`}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imágenes de muchas tiendas distintas
            <img
              src={imageUrl}
              alt=""
              width={400}
              height={400}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-contain p-3"
            />
          ) : (
            <span className="absolute inset-0 grid place-items-center text-xs text-muted">Sin foto</span>
          )}
          <span className="absolute top-2 right-2 rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-bg">
            {stores.length} tiendas
          </span>
        </div>

        <div className="relative flex flex-1 flex-col gap-1 p-3 pt-8">
          <div className="absolute top-0 left-2 -translate-y-1/2">
            <PriceTag
              price={best?.summary.price ?? null}
              listPrice={best?.summary.listPrice ?? null}
              currency={best?.watch.product.currency ?? "CLP"}
              size="sm"
              from={members.length > 1}
            />
          </div>
          <p className="text-xs text-muted">{best ? `Mejor precio en ${best.watch.product.store}` : "Sin precio"}</p>
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold sm:text-base">
            <Link href={`/grupos/${group.id}`} className="outline-none after:absolute after:inset-0">
              {group.name}
            </Link>
          </h3>
          <p className="text-xs font-medium text-muted">
            {deals > 0 ? `${deals} de ${members.length} en oferta` : stores.join(", ")}
          </p>
          <p className="mt-auto pt-1 text-xs text-muted">
            {hasErrors ? <span className="text-danger">Alguna tienda no se pudo revisar</span> : "Comparando tiendas"}
          </p>
        </div>
      </article>
    </li>
  );
}
