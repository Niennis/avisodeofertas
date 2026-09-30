import { discountPercent, isOnSale } from "@/core/domain/price";
import { formatMoney } from "@/lib/format";

const AMOUNT_SIZE = { sm: "text-base", md: "text-lg", lg: "text-2xl" };

export function PriceTag({
  price,
  listPrice,
  currency,
  size = "md",
  from = false,
}: {
  price: number | null;
  listPrice: number | null;
  currency: string;
  size?: "sm" | "md" | "lg";
  /** Muestra "desde" cuando el precio es el más bajo de varios colores. */
  from?: boolean;
}) {
  if (price == null) {
    return (
      <span className="price-tag" data-sale="false">
        <span className="price-tag-shape">
          <span className="price-tag-body text-sm text-muted">Sin precio</span>
        </span>
      </span>
    );
  }
  const sale = isOnSale(price, listPrice);
  return (
    <span className="price-tag" data-sale={sale} data-size={size}>
      <span className="price-tag-shape">
        <span className="price-tag-body">
          <span className={`font-bold ${AMOUNT_SIZE[size]}`}>
            {from && <span className="mr-1 text-[0.7em] font-medium opacity-80">desde</span>}
            {formatMoney(price, currency)}
          </span>
          {sale && (
            <span className={size === "sm" ? "text-[0.6875rem] opacity-90" : "text-xs opacity-90"}>
              <s>{formatMoney(listPrice!, currency)}</s> · −{discountPercent(price, listPrice)}%
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
