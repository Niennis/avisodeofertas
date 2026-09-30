"use client";

import { useActionState } from "react";
import { checkAllPricesAction, refreshWatchAction } from "../actions";

/** "Actualizar precio" en la ficha de un producto. */
export function RefreshPriceButton({ watchId }: { watchId: string }) {
  const [state, formAction, pending] = useActionState(refreshWatchAction, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="watchId" value={watchId} />
      <button className="btn btn-quiet px-3.5! py-1.5! text-sm" disabled={pending}>
        {pending ? "Consultando la tienda…" : "Actualizar precio"}
      </button>
      <p aria-live="polite" className="text-sm">
        {state.error && <span className="text-danger">{state.error}</span>}
        {state.ok && !pending && <span className="text-target">{state.ok}</span>}
      </p>
    </form>
  );
}

/** Administración: revisa todos los productos ahora, como la revisión programada. */
export function CheckAllPricesButton() {
  const [state, formAction, pending] = useActionState(checkAllPricesAction, {});
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <button className="btn" disabled={pending}>
        {pending ? "Revisando…" : "Revisar ahora"}
      </button>
      <p aria-live="polite" className="text-sm">
        {pending && <span className="text-muted">Puede tardar un par de minutos; no cierres esta página.</span>}
        {!pending && state.error && <span className="text-danger">{state.error}</span>}
        {!pending && state.ok && <span className="text-target">{state.ok}</span>}
      </p>
    </form>
  );
}
