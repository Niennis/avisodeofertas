export default function Loading() {
  return (
    <div role="status" className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <span className="sr-only">Cargando grupo…</span>
      <div className="h-4 w-28 animate-pulse rounded bg-line" />
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="size-32 shrink-0 animate-pulse rounded-(--radius-control) bg-line/50" />
        <div className="flex flex-1 flex-col gap-3">
          <div className="h-3 w-24 animate-pulse rounded bg-line" />
          <div className="h-7 w-3/4 animate-pulse rounded bg-line" />
          <div className="h-12 w-32 animate-pulse rounded bg-line" />
        </div>
      </div>
      <div className="h-72 card animate-pulse" />
    </div>
  );
}
