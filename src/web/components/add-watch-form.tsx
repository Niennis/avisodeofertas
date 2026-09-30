"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { addWatchAction, type AddConflict, type FormState } from "../actions";
import { AlertOptions } from "./alert-options";
import { useSubmitWithoutReset } from "./use-submit";

/** `sharedUrl`: enlace que llegó desde el menú "Compartir" del celular; queda pegado, listo para seguir. */
export function AddWatchForm({ sharedUrl = null }: { sharedUrl?: string | null }) {
  const [state, formAction, pending] = useActionState(addWatchAction, {});
  const submit = useSubmitWithoutReset(formAction);
  const formRef = useRef<HTMLFormElement>(null);
  // El aviso de conflicto se oculta al cancelarlo o al cambiar el enlace.
  const [dismissed, setDismissed] = useState<FormState | null>(null);
  const conflict = state !== dismissed ? state.conflict : undefined;

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    if (sharedUrl) {
      // `reset` vuelve a poner el enlace compartido (es el valor inicial): se borra a mano,
      // y también de la dirección, sin recargar para no perder el mensaje de "Listo".
      const input = formRef.current?.elements.namedItem("url");
      if (input instanceof HTMLInputElement) input.value = "";
      window.history.replaceState(null, "", "/");
    }
  }, [state, sharedUrl]);

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="url" className="text-sm font-medium">
        Pega el enlace de un producto
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="url"
          name="url"
          type="url"
          required
          placeholder="https://www.orquidea.cl/products/bamboo"
          defaultValue={sharedUrl ?? undefined}
          autoFocus={sharedUrl != null}
          className="field flex-1 text-base"
          onChange={() => setDismissed(state)}
        />
        <button className="btn sm:w-40" disabled={pending}>
          {pending ? "Leyendo precio…" : "Seguir producto"}
        </button>
      </div>
      <p className="-mt-1 text-xs text-muted">
        Para seguir todos los colores de una lana, pega el enlace del producto sin elegir color, o la página de la
        línea completa (como reginella.cl/2188-roma).
      </p>
      <AlertOptions />
      {conflict ? (
        <ConflictNotice conflict={conflict} pending={pending} onCancel={() => setDismissed(state)} />
      ) : (
        <p aria-live="polite" className="min-h-5 text-sm">
          {state.error && <span className="text-danger">{state.error}</span>}
          {state.ok && <span className="text-target">{state.ok}</span>}
        </p>
      )}
    </form>
  );
}

/** Explica el conflicto y ofrece las opciones; cada botón reenvía el formulario con su resolución. */
function ConflictNotice({
  conflict,
  pending,
  onCancel,
}: {
  conflict: AddConflict;
  pending: boolean;
  onCancel: () => void;
}) {
  const option = "btn btn-quiet px-3.5! py-1.5! text-sm";
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-(--radius-control) bg-target-soft p-4 text-sm">
      {conflict.status === "color-in-line" ? (
        <>
          <p>
            {conflict.excluded ? (
              <>
                <strong>{conflict.colorName}</strong> es parte de la línea <strong>{conflict.lineName}</strong> que ya
                sigues, pero lo tienes desmarcado.
              </>
            ) : (
              <>
                <strong>{conflict.colorName}</strong> ya lo sigues dentro de la línea <strong>{conflict.lineName}</strong>.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {conflict.excluded ? (
              <button name="resolution" value="include-in-line" className="btn px-3.5! py-1.5! text-sm" disabled={pending}>
                Marcarlo en la línea
              </button>
            ) : (
              <Link href={`/productos/${conflict.lineWatchId}`} className="btn px-3.5! py-1.5! text-sm">
                Ver la línea
              </Link>
            )}
            <button name="resolution" value="separate" className={option} disabled={pending}>
              Seguirlo por separado
            </button>
            <button type="button" onClick={onCancel} className={option}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Ya sigues {conflict.colors.length === 1 ? "1 color" : `${conflict.colors.length} colores`} de{" "}
            <strong>{conflict.name}</strong> por separado: {listNames(conflict.colors.map((c) => c.name))}. ¿Cómo quieres
            seguir la línea?
          </p>
          <div className="flex flex-wrap gap-2">
            <button name="resolution" value="line-all" className="btn px-3.5! py-1.5! text-sm" disabled={pending}>
              Seguir todos los colores
            </button>
            <button name="resolution" value="line-only-mine" className={option} disabled={pending}>
              Solo {conflict.colors.length === 1 ? conflict.colors[0].name : "esos colores"}
            </button>
            <button type="button" onClick={onCancel} className={option}>
              Cancelar
            </button>
          </div>
          <p className="text-xs text-muted">
            En ambos casos, las tarjetas de esos colores se reemplazan por una sola tarjeta de la línea.
          </p>
        </>
      )}
    </div>
  );
}

function listNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}
