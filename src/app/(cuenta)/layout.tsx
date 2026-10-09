import Link from "next/link";
import { ThemeToggle } from "@/web/components/theme-toggle";

export default function AccountLayout({ children }: LayoutProps<"/">) {
  return (
    <main id="contenido" className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <p className="mb-8 text-lg font-bold">
        {/* Lleva al inicio; sin sesión, el inicio redirige a "Ingresar". */}
        <Link href="/" className="price-tag" data-sale="true">
          <span className="price-tag-shape">
            <span className="price-tag-body whitespace-normal">Alerta de ofertas</span>
          </span>
        </Link>
      </p>
      {children}
    </main>
  );
}
