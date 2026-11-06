import Link from "next/link";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition/container";
import { DEMO_EXTRA_PRODUCTS, DEMO_HOURS } from "@/core/application/use-cases/demo";
import { loginAction } from "@/web/actions";
import { AuthForm } from "@/web/components/auth-form";
import { DemoButton } from "@/web/components/demo-button";
import { currentUser } from "@/web/session";
import { safeNextPath } from "@/web/shared-link";

export default async function LoginPage({ searchParams }: PageProps<"/ingresar">) {
  const next = safeNextPath((await searchParams).siguiente);
  if (await currentUser()) redirect(next ?? "/");
  const { demo } = await getContainer();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Ingresar</h1>
      <AuthForm action={loginAction} submitLabel="Ingresar" pendingLabel="Ingresando…" next={next} />
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
      {demo.enabled && <DemoButton extraProducts={DEMO_EXTRA_PRODUCTS} hours={DEMO_HOURS} />}
    </>
  );
}
