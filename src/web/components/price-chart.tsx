import type { PriceSnapshot } from "@/core/domain/product";
import { formatDate, formatMoney } from "@/lib/format";

const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 72 };

/** Historial de precio como línea escalonada; el precio normal va punteado y el objetivo en verde azulado. */
export function PriceChart({
  history,
  currency,
  targetPrice,
}: {
  history: PriceSnapshot[];
  currency: string;
  targetPrice: number | null;
}) {
  if (history.length < 2) {
    return (
      <p className="text-sm text-muted">
        El gráfico aparece desde la segunda revisión de precio. Los precios se revisan una vez al día.
      </p>
    );
  }

  const times = history.map((h) => h.checkedAt.getTime());
  const values = history.flatMap((h) => [h.price, h.listPrice ?? h.price]);
  if (targetPrice != null) values.push(targetPrice);
  const [tMin, tMax] = [Math.min(...times), Math.max(...times)];
  const margin = (Math.max(...values) - Math.min(...values)) * 0.1 || Math.max(...values) * 0.05;
  const [vMin, vMax] = [Math.min(...values) - margin, Math.max(...values) + margin];

  const x = (t: number) => PAD.left + ((t - tMin) / (tMax - tMin || 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - vMin) / (vMax - vMin)) * (H - PAD.top - PAD.bottom);

  const stepPath = (pick: (h: PriceSnapshot) => number) =>
    history
      .map((h, i) => {
        const px = x(h.checkedAt.getTime()).toFixed(1);
        const py = y(pick(h)).toFixed(1);
        return i === 0 ? `M${px},${py}` : `H${px}V${py}`;
      })
      .join("");

  const hasListPrice = history.some((h) => h.listPrice != null);
  const lowest = Math.min(...history.map((h) => h.price));

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Historial de precio">
        {[vMin + margin, (vMin + vMax) / 2, vMax - margin].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
              {formatMoney(v, currency)}
            </text>
          </g>
        ))}
        {targetPrice != null && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(targetPrice)}
            y2={y(targetPrice)}
            stroke="var(--target)"
            strokeWidth="1.5"
          />
        )}
        {hasListPrice && (
          <path
            d={stepPath((h) => h.listPrice ?? h.price)}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}
        <path d={stepPath((h) => h.price)} fill="none" stroke="var(--sale)" strokeWidth="2.5" strokeLinejoin="round" />
        <text x={PAD.left} y={H - 8} fontSize="12" fill="var(--muted)">
          {formatDate(history[0].checkedAt)}
        </text>
        <text x={W - PAD.right} y={H - 8} fontSize="12" textAnchor="end" fill="var(--muted)">
          {formatDate(history.at(-1)!.checkedAt)}
        </text>
      </svg>
      <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-sale" /> Precio
        </span>
        {hasListPrice && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-muted" /> Precio normal
          </span>
        )}
        {targetPrice != null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-target" /> Tu precio objetivo
          </span>
        )}
        <span>Más bajo registrado: {formatMoney(lowest, currency)}</span>
      </figcaption>
    </figure>
  );
}
