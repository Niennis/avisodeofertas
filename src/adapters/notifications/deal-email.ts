import type { Deal } from "@/core/application/ports/notifier";
import { discountPercent } from "@/core/domain/price";
import { formatMoney } from "@/lib/format";

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** "Agua Marina, Beige y 10 colores más" */
export function variantsText(names: string[], shown = 3): string {
  if (names.length === 0) return "";
  if (names.length <= shown) {
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
  }
  const rest = names.length - shown;
  return `${names.slice(0, shown).join(", ")} y ${rest} ${rest === 1 ? "color" : "colores"} más`;
}

function reasonText(deal: Deal): string {
  const parts: string[] = [];
  const discount = discountPercent(deal.price, deal.listPrice);
  if (deal.reasons.includes("on_sale") && discount) parts.push(`${discount}% de descuento`);
  if (deal.reasons.includes("below_target") && deal.targetPrice != null) {
    parts.push(`bajo tu precio objetivo de ${formatMoney(deal.targetPrice, deal.currency)}`);
  }
  if (deal.variants.length > 0) parts.push(`en ${variantsText(deal.variants)}`);
  return parts.join(" · ");
}

export function dealEmailSubject(deals: Deal[]): string {
  return deals.length === 1
    ? `Oferta: ${deals[0].name} a ${formatMoney(deals[0].price, deals[0].currency)}`
    : `${deals.length} productos que sigues están en oferta`;
}

export function dealEmailText(deals: Deal[], appUrl: string | null): string {
  const lines = deals.map((d) => {
    const before = d.listPrice ? ` (antes ${formatMoney(d.listPrice, d.currency)})` : "";
    return `• ${d.name} — ${d.store}\n  ${formatMoney(d.price, d.currency)}${before} · ${reasonText(d)}\n  ${d.url}`;
  });
  return [...lines, "", appUrl ? `Administra tus productos en ${appUrl}` : ""].join("\n");
}

export function dealEmailHtml(deals: Deal[], appUrl: string | null): string {
  const rows = deals
    .map((d) => {
      const image = d.imageUrl
        ? `<img src="${escapeHtml(d.imageUrl)}" width="72" height="72" alt="" style="border-radius:8px;object-fit:cover;display:block">`
        : "";
      const before = d.listPrice
        ? `<span style="color:#8a8580;text-decoration:line-through;margin-left:6px">${formatMoney(d.listPrice, d.currency)}</span>`
        : "";
      return `<tr>
  <td style="padding:12px 12px 12px 0;vertical-align:top;width:72px">${image}</td>
  <td style="padding:12px 0;vertical-align:top">
    <div style="font-size:12px;color:#8a8580;text-transform:uppercase;letter-spacing:.04em">${escapeHtml(d.store)}</div>
    <a href="${escapeHtml(d.url)}" style="color:#2b2724;font-weight:600;text-decoration:none">${escapeHtml(d.name)}</a>
    <div style="margin-top:4px;font-size:18px;font-weight:700;color:#b4451f">${formatMoney(d.price, d.currency)}${before}</div>
    <div style="font-size:13px;color:#5c5650">${escapeHtml(reasonText(d))}</div>
  </td>
</tr>`;
    })
    .join("");

  const footer = appUrl
    ? `<p style="font-size:13px;color:#8a8580;margin-top:24px">Administra tus productos en <a href="${escapeHtml(appUrl)}" style="color:#b4451f">${escapeHtml(appUrl)}</a></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f6f2ec;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px;background:#fffdf9">
  <h1 style="font-size:20px;color:#2b2724;margin:0 0 8px">¡Hay ofertas en productos que sigues!</h1>
  <table style="width:100%;border-collapse:collapse">${rows}</table>
  ${footer}
</div></body></html>`;
}
