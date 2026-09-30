import { PROBLEM_LABELS, type StoreFailures } from "@/core/domain/failures";
import { formatDateTime } from "@/lib/format";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function problemsText(store: StoreFailures): string {
  return store.problems.map((p) => PROBLEM_LABELS[p]).join(", ");
}

export function failureEmailSubject(stores: StoreFailures[]): string {
  return stores.length === 1
    ? `Alerta de ofertas: problemas para leer ${stores[0].host}`
    : `Alerta de ofertas: problemas para leer ${stores.length} tiendas`;
}

export function failureEmailText(stores: StoreFailures[], appUrl: string | null): string {
  const lines = stores.map(
    (s) =>
      `• ${s.host} — ${problemsText(s)} (${s.count} ${s.count === 1 ? "vez" : "veces"})\n  Último enlace: ${s.lastUrl}` +
      (s.lastDetail ? `\n  Detalle: ${s.lastDetail}` : ""),
  );
  return [
    "Hay enlaces que la app no pudo leer:",
    "",
    ...lines,
    "",
    appUrl ? `Revísalos en ${appUrl}/admin` : "Revísalos en la página /admin de la app.",
  ].join("\n");
}

export function failureEmailHtml(stores: StoreFailures[], appUrl: string | null): string {
  const rows = stores
    .map(
      (s) => `<tr>
  <td style="padding:10px 0;border-top:1px solid #e3e3e3;vertical-align:top">
    <div style="font-weight:600;color:#1e2a3a">${escapeHtml(s.host)}</div>
    <div style="font-size:13px;color:#5f6975">${escapeHtml(problemsText(s))} · ${s.count} ${s.count === 1 ? "vez" : "veces"} · ${escapeHtml(formatDateTime(s.lastAt))}</div>
    <div style="font-size:13px;margin-top:4px"><a href="${escapeHtml(s.lastUrl)}" style="color:#c8285e;word-break:break-all">${escapeHtml(s.lastUrl)}</a></div>
    ${s.lastDetail ? `<div style="font-size:12px;color:#8a8f96;margin-top:4px">${escapeHtml(s.lastDetail)}</div>` : ""}
  </td>
</tr>`,
    )
    .join("");
  const link = appUrl
    ? `<p style="margin-top:20px"><a href="${escapeHtml(appUrl)}/admin" style="color:#c8285e">Ver todos en la página de administración</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#eef1ec;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px;background:#ffffff">
  <h1 style="font-size:18px;color:#1e2a3a;margin:0 0 8px">Enlaces que la app no pudo leer</h1>
  <p style="font-size:14px;color:#5f6975;margin:0 0 12px">Agrupados por tienda. Con estos enlaces se puede agregar un lector para cada una.</p>
  <table style="width:100%;border-collapse:collapse">${rows}</table>
  ${link}
</div></body></html>`;
}
