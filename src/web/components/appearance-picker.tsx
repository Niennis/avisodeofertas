"use client";

import { useState, useTransition } from "react";
import type { Palette } from "@/core/domain/user";
import { updatePaletteAction } from "../actions";
import { PriceTag } from "./price-tag";

const OPTIONS: { value: Palette; name: string; description: string }[] = [
  { value: "sobria", name: "Sobria", description: "La de siempre: clara y sin distracciones." },
  { value: "caramelo", name: "Caramelo", description: "Pastel y redondeada, con sombras tipo sticker." },
  { value: "electrico", name: "Eléctrico", description: "Neón, con brillo en las ofertas." },
  { value: "jardin", name: "Jardín", description: "Lino, musgo y rosa viejo." },
];

/**
 * Selector de paleta. Se aplica al instante y se guarda en la cuenta.
 * Cada opción es una vista previa real: lleva su propio data-palette.
 */
export function AppearancePicker({ current }: { current: Palette }) {
  const [selected, setSelected] = useState(current);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(palette: Palette) {
    const previous = selected;
    setSelected(palette);
    setMessage(null);
    document.documentElement.setAttribute("data-palette", palette);
    startTransition(async () => {
      const result = await updatePaletteAction(palette);
      if (result.error) {
        setSelected(previous);
        document.documentElement.setAttribute("data-palette", previous);
      }
      setMessage(result.error ?? result.ok ?? null);
    });
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Paleta de colores</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {OPTIONS.map((option) => (
          <label key={option.value} className="group cursor-pointer">
            <input
              type="radio"
              name="palette"
              value={option.value}
              checked={selected === option.value}
              onChange={() => choose(option.value)}
              className="peer sr-only"
            />
            <span
              data-palette={option.value}
              className="card flex h-full flex-col gap-3 bg-bg! p-3 text-ink outline-offset-2 peer-checked:outline-3 peer-checked:outline-(--ink) peer-focus-visible:outline-2 peer-focus-visible:outline-dashed"
            >
              <span className="flex gap-1.5" aria-hidden>
                {["--sale", "--btn-bg", "--target", "--surface"].map((token) => (
                  <span
                    key={token}
                    className="size-4 rounded-full border border-(--line)"
                    style={{ background: `var(${token})` }}
                  />
                ))}
              </span>
              <span aria-hidden className="self-start">
                <PriceTag price={4990} listPrice={6290} currency="CLP" size="sm" />
              </span>
              <span className="flex flex-col">
                <span className="font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  {option.name}
                </span>
                <span className="text-xs text-muted">{option.description}</span>
              </span>
            </span>
          </label>
        ))}
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {pending ? "Guardando…" : message}
      </p>
    </fieldset>
  );
}
