"use client";

import { useActionState } from "react";
import { renameGroupAction } from "../actions";
import { useSubmitWithoutReset } from "./use-submit";

export function GroupNameForm({ groupId, name }: { groupId: string; name: string }) {
  const [state, formAction, pending] = useActionState(renameGroupAction, {});
  const submit = useSubmitWithoutReset(formAction);
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <label htmlFor="group-name" className="text-sm font-medium">
        Nombre del grupo
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id="group-name" name="name" defaultValue={name} required maxLength={120} className="field flex-1" />
        <button className="btn btn-quiet sm:w-44" disabled={pending}>
          {pending ? "Guardando…" : "Guardar nombre"}
        </button>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm">
        {state.error && <span className="text-danger">{state.error}</span>}
        {state.ok && <span className="text-target">{state.ok}</span>}
      </p>
    </form>
  );
}
