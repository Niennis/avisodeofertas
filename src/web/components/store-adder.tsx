"use client";

import { useActionState } from "react";
import { addStoreAction, groupWithAction } from "../actions";
import { useSubmitWithoutReset } from "./use-submit";

export interface GroupCandidate {
  /** Seguimiento a juntar (en un grupo, cualquiera de sus miembros). */
  watchId: string;
  label: string;
}

/**
 * "Agregar otra tienda" (pegando un enlace) y "Agrupar con uno que ya sigo".
 * Sirve tanto en el detalle de un producto como en la página de un grupo.
 */
export function StoreAdder({ anchorWatchId, candidates }: { anchorWatchId: string; candidates: GroupCandidate[] }) {
  const [addState, addAction, adding] = useActionState(addStoreAction, {});
  const [groupState, groupAction, grouping] = useActionState(groupWithAction, {});
  const submitAdd = useSubmitWithoutReset(addAction);
  const submitGroup = useSubmitWithoutReset(groupAction);

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submitAdd} className="flex flex-col gap-2">
        <input type="hidden" name="anchorWatchId" value={anchorWatchId} />
        <label htmlFor="store-url" className="text-sm font-medium">
          Agregar otra tienda
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="store-url"
            name="url"
            type="url"
            required
            placeholder="Enlace del mismo producto en otra tienda"
            className="field flex-1"
          />
          <button className="btn sm:w-44" disabled={adding}>
            {adding ? "Leyendo precio…" : "Agregar tienda"}
          </button>
        </div>
        <p aria-live="polite" className="min-h-5 text-sm text-danger">
          {addState.error}
        </p>
      </form>

      {candidates.length > 0 && (
        <form onSubmit={submitGroup} className="flex flex-col gap-2">
          <input type="hidden" name="anchorWatchId" value={anchorWatchId} />
          <label htmlFor="group-with" className="text-sm font-medium">
            O agrupar con uno que ya sigues
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select id="group-with" name="otherWatchId" required defaultValue="" className="field flex-1">
              <option value="" disabled>
                Elige un producto…
              </option>
              {candidates.map((c) => (
                <option key={c.watchId} value={c.watchId}>
                  {c.label}
                </option>
              ))}
            </select>
            <button className="btn btn-quiet sm:w-44" disabled={grouping}>
              {grouping ? "Agrupando…" : "Agrupar"}
            </button>
          </div>
          <p aria-live="polite" className="min-h-5 text-sm text-danger">
            {groupState.error}
          </p>
        </form>
      )}
    </div>
  );
}
