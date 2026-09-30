import { PALETTES } from "@/core/domain/user";

/** Modo claro/oscuro: se recuerda por navegador. */
export const THEME_STORAGE_KEY = "tema";
/** Paleta: se guarda en la cuenta y se copia a esta cookie para aplicarla antes de pintar. */
export const PALETTE_COOKIE = "paleta";

/** Script para el <head>: aplica modo y paleta guardados antes de pintar, sin parpadeo. */
export const themeInitScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var m=document.cookie.match(/(?:^|; )${PALETTE_COOKIE}=([^;]*)/);if(m&&${JSON.stringify(PALETTES)}.indexOf(m[1])>=0)d.setAttribute("data-palette",m[1])}catch(e){}})()`;
