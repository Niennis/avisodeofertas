import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/web/components/password-reset-forms";

// El token va en la URL: que no se filtre a otros sitios en el encabezado Referer.
export const metadata: Metadata = { referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/restablecer">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <>
        <h1 className="mb-2 text-2xl font-bold">Enlace incompleto</h1>
        <p className="mb-6 text-sm text-muted">
          Abre el enlace completo que te llegó por email, o pide uno nuevo.
        </p>
        <Link href="/recuperar" className="btn">
          Pedir un enlace nuevo
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">Crea una contraseña nueva</h1>
      <p className="mb-6 text-sm text-muted">Al guardarla se cerrarán las sesiones abiertas en otros dispositivos.</p>
      <ResetPasswordForm token={token} />
      <p className="mt-6 text-sm text-muted">
        ¿El enlace venció?{" "}
        <Link href="/recuperar" className="font-medium text-ink underline underline-offset-4">
          Pide uno nuevo
        </Link>
      </p>
    </>
  );
}
