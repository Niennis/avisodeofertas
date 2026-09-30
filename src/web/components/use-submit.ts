"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Envía el formulario a una Server Action sin que React lo reinicie al terminar.
 * Con `<form action>` React 19 limpia los campos incluso si hubo un error,
 * y la persona pierde lo que escribió (por ejemplo, el enlace que pegó).
 */
export function useSubmitWithoutReset(dispatch: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Incluye el botón presionado (name/value), como haría un envío normal.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(data));
  };
}
