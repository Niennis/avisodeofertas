import { cardGridClass, WatchCardSkeleton } from "@/web/components/watch-card";

/** Se muestra mientras el servidor busca los productos. */
export default function Loading() {
  return (
    <div role="status" className="flex flex-col gap-10">
      <span className="sr-only">Cargando tus productos…</span>
      <div className="h-40 card animate-pulse" />
      <ul className={cardGridClass}>
        {Array.from({ length: 8 }, (_, i) => (
          <WatchCardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}
