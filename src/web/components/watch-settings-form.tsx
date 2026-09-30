"use client";

import { useActionState } from "react";
import { updateWatchAction } from "../actions";
import { AlertOptions } from "./alert-options";
import { useSubmitWithoutReset } from "./use-submit";

export function WatchSettingsForm({
  watchId,
  notifyOnSale,
  targetPrice,
}: {
  watchId: string;
  notifyOnSale: boolean;
  targetPrice: number | null;
}) {
  const [state, formAction, pending] = useActionState(updateWatchAction, {});
  const submit = useSubmitWithoutReset(formAction);
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input type="hidden" name="watchId" value={watchId} />
      <AlertOptions notifyOnSale={notifyOnSale} targetPrice={targetPrice} />
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <p aria-live="polite" className="text-sm">
          {state.error && <span className="text-danger">{state.error}</span>}
          {state.ok && <span className="text-target">{state.ok}</span>}
        </p>
      </div>
    </form>
  );
}
