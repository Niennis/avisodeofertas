import Link from "next/link";
import { ForgotPasswordForm } from "@/web/components/password-reset-forms";

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">¿Olvidaste tu contraseña?</h1>
      <p className="mb-6 text-sm text-muted">Escribe el email de tu cuenta y te enviaremos un enlace para crear una nueva.</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-muted">
        <Link href="/ingresar" className="font-medium text-ink underline underline-offset-4">
          Volver a ingresar
        </Link>
      </p>
    </>
  );
}
