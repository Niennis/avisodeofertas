"use client";

import { useActionState } from "react";
import { CHECKS_PER_DAY_OPTIONS, describeCheckHours, type ChecksPerDay } from "@/core/domain/check-schedule";
import { updateChecksPerDayAction } from "../actions";

/** Administración: cuántas revisiones de precio (y emails de avisos) puede haber al día. */
export function CheckScheduleForm({ current }: { current: ChecksPerDay }) {
  const [state, formAction, pending] = useActionState(updateChecksPerDayAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Revisiones al día</legend>
        {CHECKS_PER_DAY_OPTIONS.map((n) => (
          <label key={n} className="flex items-start gap-3">
            <input
              type="radio"
              name="checksPerDay"
              value={n}
              defaultChecked={n === current}
              className="mt-1 size-4 shrink-0 accent-(--sale)"
            />
            <span>
              <span className="font-medium">{n === 1 ? "1 vez" : `${n} veces`}</span>{" "}
              <span className="text-sm text-muted">({describeCheckHours(n)})</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted">
        Cada persona recibe como máximo un email por revisión, así que esto también limita los emails de avisos al día.
      </p>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        <p aria-live="polite" className="text-sm">
          {state.error && <span className="text-danger">{state.error}</span>}
          {state.ok && <span className="text-target">{state.ok}</span>}
        </p>
      </div>
    </form>
  );
}
