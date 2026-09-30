"use client";

import { useActionState } from "react";
import type { FormState } from "../actions";
import { PasswordField } from "./password-field";
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
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Email</span>
        <input className="field" type="email" name="email" autoComplete="email" required />
      </label>
      <PasswordField isNew={askInviteCode} />
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
