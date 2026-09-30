function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const passwordResetEmailSubject = "Alerta de ofertas: crea una contraseña nueva";

export function passwordResetEmailText(link: string, validMinutes: number): string {
  return [
    "Pediste crear una contraseña nueva para Alerta de ofertas.",
    "",
    `Abre este enlace para elegirla (vence en ${validMinutes} minutos):`,
    link,
    "",
    "Si no fuiste tú, ignora este email: tu contraseña actual sigue funcionando.",
  ].join("\n");
}

export function passwordResetEmailHtml(link: string, validMinutes: number): string {
  return `<!doctype html><html><body style="margin:0;background:#f3efe9;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px;background:#ffffff">
  <h1 style="font-size:18px;color:#2b2622;margin:0 0 8px">Crea una contraseña nueva</h1>
  <p style="font-size:14px;color:#5f5953;margin:0 0 20px">Pediste crear una contraseña nueva para Alerta de ofertas. El enlace vence en ${validMinutes} minutos.</p>
  <p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#b4451f;color:#ffffff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px">Elegir contraseña nueva</a></p>
  <p style="font-size:13px;color:#8a8580;margin:0 0 8px">Si el botón no funciona, copia este enlace en el navegador:<br><a href="${escapeHtml(link)}" style="color:#b4451f;word-break:break-all">${escapeHtml(link)}</a></p>
  <p style="font-size:13px;color:#8a8580;margin:16px 0 0">Si no fuiste tú, ignora este email: tu contraseña actual sigue funcionando.</p>
</div></body></html>`;
}
