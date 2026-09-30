import Link from "next/link";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition/container";
import { registerAction } from "@/web/actions";
import { AuthForm } from "@/web/components/auth-form";
import { currentUser } from "@/web/session";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/");
  const { config } = await getContainer();
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold">Crear cuenta</h1>
      <p className="mb-6 text-sm text-muted">Sigue productos de tus tiendas favoritas y recibe un email cuando bajen de precio.</p>
      <AuthForm
        action={registerAction}
        submitLabel="Crear cuenta"
        pendingLabel="Creando cuenta…"
        askInviteCode={config.inviteCode != null}
      />
      <p className="mt-6 text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/ingresar" className="font-medium text-ink underline underline-offset-4">
          Ingresa
        </Link>
      </p>
    </>
  );
}
