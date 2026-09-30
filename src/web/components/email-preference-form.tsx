"use client";

import { useActionState } from "react";
import { updateEmailNotificationsAction } from "../actions";

export function EmailPreferenceForm({ email, enabled }: { email: string; enabled: boolean }) {
  const [state, formAction, pending] = useActionState(updateEmailNotificationsAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="emailNotifications"
          defaultChecked={enabled}
          className="mt-1 size-4 shrink-0 accent-(--sale)"
        />
        <span>
          <span className="block font-medium">Recibir un email cuando haya ofertas</span>
          <span className="block text-sm text-muted">
            Se envía a {email}, como máximo uno por revisión, con todas las ofertas nuevas juntas. Aunque lo
            desactives, las ofertas se siguen mostrando en tu lista.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        <p aria-live="polite" className="text-sm text-target">
          {state.ok}
        </p>
      </div>
    </form>
  );
}
