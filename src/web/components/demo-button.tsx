"use client";

import { useActionState } from "react";
import { startDemoAction, type FormState } from "../actions";

/** "Probar la demo" en Ingresar y Crear cuenta: entra a una cuenta temporal con productos de ejemplo. */
export function DemoButton({ extraProducts, hours }: { extraProducts: number; hours: number }) {
  const [state, formAction, pending] = useActionState<FormState>(startDemoAction, {});
  return (
    <section aria-labelledby="demo-title" className="mt-8 border-t-(length:--border-w) border-line pt-6">
      <h2 id="demo-title" className="text-base font-bold">
        ¿Vienes a conocer el proyecto?
      </h2>
      <p id="demo-desc" className="mt-1 mb-4 text-sm text-muted">
        Entra a una cuenta de prueba con productos de ejemplo, sin registrarte. Puedes agregar hasta {extraProducts}{" "}
        productos más; los emails están desactivados y la cuenta se borra en {hours} horas.
      </p>
      <form action={formAction}>
        <button className="btn btn-quiet w-full" disabled={pending} aria-describedby="demo-desc">
          {pending ? "Preparando la demo…" : "Probar la demo"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="mt-3 text-sm text-danger-text">
          {state.error}
        </p>
      )}
    </section>
  );
}
