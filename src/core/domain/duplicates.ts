import { sameProductUrl } from "./product-url";
import type { Product } from "./product";
import type { WatchWithProduct } from "./watch";

/** El enlace pegado es un color de una línea que el usuario ya sigue. */
export interface ColorInLine {
  lineWatchId: string;
  lineName: string;
  colorKey: string;
  colorName: string;
  /** El color está en la línea, pero el usuario lo desmarcó. */
  excluded: boolean;
}

/** Un color de la línea pegada que el usuario ya sigue como producto aparte. */
export interface SeparateColor {
  watchId: string;
  key: string;
  name: string;
}

export function findLineContaining(url: string, watches: WatchWithProduct[]): ColorInLine | null {
  for (const watch of watches) {
    const variant = watch.product.variants.find((v) => v.url && sameProductUrl(v.url, url));
    if (variant) {
      return {
        lineWatchId: watch.id,
        lineName: watch.product.name,
        colorKey: variant.key,
        colorName: variant.name,
        excluded: watch.excludedVariants.includes(variant.key),
      };
    }
  }
  return null;
}

export function findColorsFollowedSeparately(line: Product, watches: WatchWithProduct[]): SeparateColor[] {
  const separate: SeparateColor[] = [];
  for (const variant of line.variants) {
    if (!variant.url) continue;
    const watch = watches.find((w) => w.product.variants.length === 0 && sameProductUrl(w.product.url, variant.url!));
    if (watch) separate.push({ watchId: watch.id, key: variant.key, name: variant.name });
  }
  return separate;
}
