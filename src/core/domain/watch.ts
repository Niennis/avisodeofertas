import type { PriceOption } from "./alert-policy";
import type { Product } from "./product";
import { includedVariants, summarizeVariants, type PriceSummary, type ProductVariant } from "./variants";

/** Seguimiento de un producto por parte de un usuario, con sus condiciones de aviso. */
export interface Watch {
  id: string;
  userId: string;
  productId: string;
  /** Avisar cuando el precio sea igual o menor a este valor. */
  targetPrice: number | null;
  /** Avisar cuando la tienda marque el producto como rebajado. */
  notifyOnSale: boolean;
  /** Avisar cuando un producto (o color) agotado vuelva a estar disponible. */
  notifyOnRestock: boolean;
  lastRestockNotifiedAt: Date | null;
  /** Precio con el que se envió el último aviso; `null` si la condición dejó de cumplirse. */
  lastNotifiedPrice: number | null;
  lastNotifiedAt: Date | null;
  /** Variantes (colores) que el usuario desmarcó; las nuevas quedan incluidas. */
  excludedVariants: string[];
  /** Grupo de "mismo producto en varias tiendas" al que pertenece, si alguno. */
  groupId: string | null;
  createdAt: Date;
}

export interface WatchWithProduct extends Watch {
  product: Product;
}

export interface WatchSettings {
  targetPrice: number | null;
  notifyOnSale: boolean;
  /** Si no se indica, no se cambia (al crear: desactivado). */
  notifyOnRestock?: boolean;
}

/** Opciones de precio que cuentan para este seguimiento: los colores incluidos o el producto simple. */
export function watchPriceOptions(product: Product, excluded: readonly string[]): (PriceOption & Partial<ProductVariant>)[] {
  if (product.variants.length > 0) return includedVariants(product.variants, excluded);
  if (product.price == null) return [];
  return [{ price: product.price, listPrice: product.listPrice, available: product.available }];
}

/** Precio a mostrar para un seguimiento, considerando solo los colores incluidos. */
export function watchSummary(watch: WatchWithProduct): PriceSummary | null {
  const { product } = watch;
  if (product.variants.length === 0) {
    return product.price == null
      ? null
      : { price: product.price, listPrice: product.listPrice, available: product.available };
  }
  return summarizeVariants(includedVariants(product.variants, watch.excludedVariants));
}
