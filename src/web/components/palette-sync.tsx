"use client";

import { useEffect } from "react";
import type { Palette } from "@/core/domain/user";
import { PALETTE_COOKIE } from "../theme";

/** Aplica la paleta de la cuenta si este navegador tenía otra (por ejemplo, se cambió en otro dispositivo). */
export function PaletteSync({ palette }: { palette: Palette }) {
  useEffect(() => {
    if (document.documentElement.getAttribute("data-palette") === palette) return;
    document.documentElement.setAttribute("data-palette", palette);
    document.cookie = `${PALETTE_COOKIE}=${palette}; path=/; max-age=31536000; SameSite=Lax`;
  }, [palette]);
  return null;
}
