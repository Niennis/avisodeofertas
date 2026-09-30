"use client";

import { useActionState, useState } from "react";
import type { FormState } from "../actions";
import { useSubmitWithoutReset } from "./use-submit";

export function AuthForm({
  action,
  submitLabel,
  pendingLabel,
  askInviteCode = false,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  askInviteCode?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const submit = useSubmitWithoutReset(formAction);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <input className="field" type="email" name="email" autoComplete="email" required />
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            className="field pr-20"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete={askInviteCode ? "new-password" : "current-password"}
            minLength={askInviteCode ? 8 : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-controls="password"
            aria-pressed={showPassword}
            className="absolute inset-y-1 right-1 rounded-md px-3 text-sm font-medium text-muted hover:text-ink"
          >
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </div>
        {askInviteCode && <span className="text-xs text-muted">Mínimo 8 caracteres.</span>}
      </div>
      {askInviteCode && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Código de invitación</span>
          <input className="field" name="inviteCode" autoComplete="off" />
          <span className="text-xs text-muted">Pídeselo a quien te compartió la página.</span>
        </label>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button className="btn mt-2" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
