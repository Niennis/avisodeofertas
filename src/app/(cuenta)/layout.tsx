import { ThemeToggle } from "@/web/components/theme-toggle";

export default function AccountLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <p className="mb-8 text-lg font-bold">
        <span className="price-tag" data-sale="true">
          <span className="price-tag-shape">
            <span className="price-tag-body">Alerta de ofertas</span>
          </span>
        </span>
      </p>
      {children}
    </main>
  );
}
