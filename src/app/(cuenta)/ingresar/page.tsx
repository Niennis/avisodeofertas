import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/web/actions";
import { AuthForm } from "@/web/components/auth-form";
import { currentUser } from "@/web/session";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Ingresar</h1>
      <AuthForm action={loginAction} submitLabel="Ingresar" pendingLabel="Ingresando…" />
      <p className="mt-4 text-sm">
        <Link href="/recuperar" className="text-muted underline underline-offset-4 hover:text-ink">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <p className="mt-6 text-sm text-muted">
        ¿Primera vez?{" "}
        <Link href="/registro" className="font-medium text-ink underline underline-offset-4">
          Crea tu cuenta
        </Link>
      </p>
    </>
  );
}
