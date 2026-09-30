"use client";

import { useActionState, useRef } from "react";
import { isOnSale } from "@/core/domain/price";
import type { ProductVariant } from "@/core/domain/variants";
import { formatMoney } from "@/lib/format";
import { selectVariantsAction } from "../actions";
import { useSubmitWithoutReset } from "./use-submit";

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

/** Lista de colores de una línea: los marcados son los que se siguen. Primero los rebajados. */
export function VariantPicker({
  watchId,
  variants,
  excluded,
  currency,
}: {
  watchId: string;
  variants: ProductVariant[];
  excluded: string[];
  currency: string;
}) {
  const [state, formAction, pending] = useActionState(selectVariantsAction, {});
  const submit = useSubmitWithoutReset(formAction);
  const formRef = useRef<HTMLFormElement>(null);
  const skip = new Set(excluded);
  const sorted = [...variants].sort(
    (a, b) =>
      Number(isOnSale(b.price, b.listPrice)) - Number(isOnSale(a.price, a.listPrice)) || collator.compare(a.name, b.name),
  );

  function setAll(checked: boolean) {
    formRef.current
      ?.querySelectorAll<HTMLInputElement>('input[name="variant"]')
      .forEach((input) => (input.checked = checked));
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
      <input type="hidden" name="watchId" value={watchId} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-muted">Te avisamos solo por los colores marcados.</span>
        <button type="button" onClick={() => setAll(true)} className="font-medium underline underline-offset-4">
          Marcar todos
        </button>
        <button type="button" onClick={() => setAll(false)} className="font-medium underline underline-offset-4">
          Desmarcar todos
        </button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {sorted.map((variant) => {
          const sale = isOnSale(variant.price, variant.listPrice);
          return (
            <li key={variant.key}>
              <label className="flex cursor-pointer items-center gap-3 rounded-(--radius-control) border-(length:--border-w) border-line p-2 hover:border-ink has-checked:border-ink">
                <input
                  type="checkbox"
                  name="variant"
                  value={variant.key}
                  defaultChecked={!skip.has(variant.key)}
                  className="size-4 shrink-0 accent-(--sale)"
                />
                {variant.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- imágenes de muchas tiendas distintas
                  <img
                    src={variant.imageUrl}
                    alt=""
                    width={40}
                    height={40}
                    loading="lazy"
                    className="size-10 shrink-0 rounded-md bg-white object-contain"
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{variant.name}</span>
                  <span className="block text-xs text-muted">
                    <span className={sale ? "font-semibold text-sale" : undefined}>
                      {formatMoney(variant.price, currency)}
                    </span>
                    {sale && <s className="ml-1.5">{formatMoney(variant.listPrice!, currency)}</s>}
                    {variant.available === false && " · agotado"}
                  </span>
                </span>
                {variant.url && (
                  <a
                    href={variant.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs text-muted underline underline-offset-4 hover:text-ink"
                  >
                    Ver
                  </a>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>
          {pending ? "Guardando…" : "Guardar colores"}
        </button>
        <p aria-live="polite" className="text-sm">
          {state.error && <span className="text-danger">{state.error}</span>}
          {state.ok && <span className="text-target">{state.ok}</span>}
        </p>
      </div>
    </form>
  );
}
