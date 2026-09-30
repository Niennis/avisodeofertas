export default function Loading() {
  return (
    <div role="status" className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <span className="sr-only">Cargando…</span>
      <div className="h-4 w-28 animate-pulse rounded bg-line" />
      <div className="h-8 w-40 animate-pulse rounded bg-line" />
      <div className="h-40 card animate-pulse" />
    </div>
  );
}
