"use client";

import { useActionState } from "react";
import { requestPasswordResetAction, resetPasswordAction } from "../actions";
import { PasswordField } from "./password-field";
import { useSubmitWithoutReset } from "./use-submit";

/** Pide el email para enviar el enlace de recuperación. */
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, {});
  const submit = useSubmitWithoutReset(formAction);
  if (state.ok) {
    return (
      <p role="status" className="text-sm text-target">
        {state.ok}
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <input className="field" type="email" name="email" autoComplete="email" required />
      </label>
      <button className="btn mt-2" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}

/** Elige la contraseña nueva con el token del enlace recibido por email. */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, {});
  const submit = useSubmitWithoutReset(formAction);
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <PasswordField label="Contraseña nueva" isNew />
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button className="btn mt-2" disabled={pending}>
        {pending ? "Guardando…" : "Guardar e ingresar"}
      </button>
    </form>
  );
}
