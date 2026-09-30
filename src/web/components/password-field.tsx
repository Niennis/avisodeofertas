"use client";

import { useState } from "react";

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export function PasswordField({
  label = "Contraseña",
  isNew = false,
}: {
  label?: string;
  /** Contraseña que se está creando: pide el mínimo y el navegador puede sugerir una. */
  isNew?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="password" className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id="password"
          className="field pr-20"
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete={isNew ? "new-password" : "current-password"}
          minLength={isNew ? 8 : undefined}
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
      {isNew && <span className="text-xs text-muted">Mínimo 8 caracteres.</span>}
    </div>
  );
}
