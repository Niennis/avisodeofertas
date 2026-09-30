import Link from "next/link";
import { isOnSale } from "@/core/domain/price";
import { includedVariants } from "@/core/domain/variants";
import { watchSummary, type WatchWithProduct } from "@/core/domain/watch";
import { formatMoney } from "@/lib/format";
import { PriceTag } from "./price-tag";

export function WatchCard({ watch, emailNotifications }: { watch: WatchWithProduct; emailNotifications: boolean }) {
  const { product } = watch;
  const summary = watchSummary(watch);
  const included = includedVariants(product.variants, watch.excludedVariants);
  const hasPriceRange = new Set(included.map((v) => v.price)).size > 1;
  const conditions = [
    watch.notifyOnSale && "si lo rebajan",
    watch.targetPrice != null && `si cuesta ${formatMoney(watch.targetPrice, product.currency)} o menos`,
  ].filter(Boolean);

  return (
    <li>
      <article className="card relative flex h-full flex-col overflow-hidden transition-colors hover:border-ink has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ink">
        <div className={`relative aspect-square ${product.imageUrl ? "bg-white" : "bg-line/40"}`}>
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imágenes de muchas tiendas distintas
            <img
              src={product.imageUrl}
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
          {product.available === false && (
            <span className="absolute top-2 right-2 rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-bg">
              Agotado
            </span>
          )}
        </div>

        {/* La etiqueta cuelga sobre el borde de la foto. */}
        <div className="relative flex flex-1 flex-col gap-1 p-3 pt-8">
          <div className="absolute top-0 left-2 -translate-y-1/2">
            <PriceTag
              price={summary?.price ?? null}
              listPrice={summary?.listPrice ?? null}
              currency={product.currency}
              size="sm"
              from={hasPriceRange}
            />
          </div>
          <p className="text-xs text-muted">{product.store}</p>
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold sm:text-base">
            <Link href={`/productos/${watch.id}`} className="outline-none after:absolute after:inset-0">
              {product.name}
            </Link>
          </h3>
          {product.variants.length > 1 && (
            <p className="text-xs font-medium text-muted">{variantsLabel(product.variants.length, included)}</p>
          )}
          <p className="mt-auto pt-1 text-xs text-muted">
            {product.lastError ? (
              <span className="line-clamp-2 text-danger" title={product.lastError}>
                No se pudo revisar
              </span>
            ) : (
              <>
                {emailNotifications ? "Te avisamos" : "En oferta"} {conditions.join(" o ")}
              </>
            )}
          </p>
        </div>
      </article>
    </li>
  );
}

/** "38 colores · 12 en oferta" o "3 de 38 colores · todos en oferta". */
function variantsLabel(total: number, included: { price: number; listPrice: number | null }[]): string {
  const count = included.length === total ? `${total} colores` : `${included.length} de ${total} colores`;
  const onSale = included.filter((v) => isOnSale(v.price, v.listPrice)).length;
  if (onSale === 0) return count;
  return `${count} · ${onSale === included.length ? "todos en oferta" : `${onSale} en oferta`}`;
}

/** Tarjeta vacía para el estado de carga. */
export function WatchCardSkeleton() {
  return (
    <li aria-hidden className="card flex flex-col overflow-hidden">
      <div className="aspect-square animate-pulse bg-line/50" />
      <div className="flex flex-col gap-2 p-3 pt-8">
        <div className="h-3 w-1/3 animate-pulse rounded bg-line" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-line" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-line" />
      </div>
    </li>
  );
}

export const cardGridClass = "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5";
