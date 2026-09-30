import type { PriceInsight } from "@/core/domain/price-insight";
import { insightBadge, insightLines, type InsightTone } from "@/lib/price-insight-text";

const TONE_CLASS: Record<InsightTone, string> = {
  good: "text-target",
  warn: "text-danger",
  neutral: "text-muted",
};
const TONE_ICON: Record<InsightTone, string> = { good: "✓", warn: "!", neutral: "·" };

/** "¿Es buena oferta?" en la ficha del producto. */
export function PriceInsightNote({
  insight,
  price,
  listPrice,
  currency,
  isLine,
}: {
  insight: PriceInsight | null;
  price: number | null;
  listPrice: number | null;
  currency: string;
  isLine: boolean;
}) {
  if (!insight) return null;
  const lines = insightLines(insight, { price, listPrice, currency });
  if (lines.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {lines.map((line) => (
        <li key={line.text} className={`flex gap-2 ${TONE_CLASS[line.tone]}`}>
          <span aria-hidden className="w-3 shrink-0 text-center font-bold">
            {TONE_ICON[line.tone]}
          </span>
          <span>{line.text}</span>
        </li>
      ))}
      {isLine && <li className="pl-5 text-xs text-muted">Según el precio destacado de la línea.</li>}
    </ul>
  );
}

/** Distintivo sobre la foto de la tarjeta: "Oferta dudosa" o "Mínimo en 90 días". */
export function PriceInsightBadge({ insight }: { insight: PriceInsight | null }) {
  const badge = insightBadge(insight);
  if (!badge) return null;
  const style = badge.tone === "warn" ? "bg-surface text-danger ring-1 ring-danger" : "bg-target-soft text-target";
  return (
    <span className={`absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{badge.text}</span>
  );
}
