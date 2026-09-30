import type { MetadataRoute } from "next";

/** Datos para instalar la app en el celular o el computador (PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alerta de ofertas",
    short_name: "Ofertas",
    description: "Te avisa por email cuando los productos que sigues bajan de precio.",
    lang: "es-CL",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Colores de la paleta predeterminada (clara): se ven al abrir la app, antes de que cargue.
    background_color: "#eef1ec",
    theme_color: "#eef1ec",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // En Android, la app aparece en el menú "Compartir": el enlace de la tienda llega al formulario para seguirlo.
    share_target: {
      action: "/compartir",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
