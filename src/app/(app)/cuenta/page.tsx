import Link from "next/link";
import { AppearancePicker } from "@/web/components/appearance-picker";
import { EmailPreferenceForm } from "@/web/components/email-preference-form";
import { requireUser } from "@/web/session";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ‹ Mis productos
      </Link>
      <h1 className="text-2xl font-bold">Mi cuenta</h1>
      <section className="card p-5">
        <h2 className="mb-1 font-bold">Apariencia</h2>
        <p className="mb-4 text-sm text-muted">
          La paleta se guarda en tu cuenta. El modo claro u oscuro se cambia con el botón de arriba y se recuerda en
          cada dispositivo.
        </p>
        <AppearancePicker current={user.palette} />
      </section>
      <section className="card p-5">
        <h2 className="mb-4 font-bold">Avisos por email</h2>
        <EmailPreferenceForm email={user.email} enabled={user.emailNotifications} />
      </section>
    </main>
  );
}
