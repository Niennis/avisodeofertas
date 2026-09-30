import type { Metadata, Viewport } from "next";
import { Fraunces, Fredoka, Nunito, Nunito_Sans, Schibsted_Grotesk, Sora, Unbounded } from "next/font/google";
import { themeInitScript } from "@/web/theme";
import "./globals.css";

const schibsted = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"] });
// Tipografías de las otras paletas: sin precarga, el navegador solo descarga las que se usan.
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], preload: false });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], preload: false });
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], preload: false });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], preload: false });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], preload: false });
const nunitoSans = Nunito_Sans({ variable: "--font-nunito-sans", subsets: ["latin"], preload: false });
const fontVariables = [schibsted, fredoka, nunito, sora, unbounded, fraunces, nunitoSans]
  .map((font) => font.variable)
  .join(" ");

export const metadata: Metadata = {
  title: "Alerta de ofertas",
  description: "Te avisa por email cuando los productos que sigues bajan de precio.",
  // Al instalarla en iPhone ("Agregar a inicio"): nombre bajo el ícono y pantalla completa.
  appleWebApp: { title: "Ofertas", capable: true, statusBarStyle: "default" },
};

// Color de la barra del sistema en el celular, según el modo claro u oscuro de la paleta predeterminada.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#151b22" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // El script fija data-theme y data-palette antes de hidratar; por eso se ignora esa diferencia.
    <html lang="es-CL" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
