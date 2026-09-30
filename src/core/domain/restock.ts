import { includedVariants, type ProductVariant } from "./variants";

/**
 * Cuándo volvió a haber stock de cada opción (fecha ISO): la clave del color en una línea,
 * o `SIMPLE_KEY` en un producto simple. Se guarda en el producto, así el aviso no se pierde
 * aunque otra lectura (por ejemplo "Actualizar precio") vea el cambio antes que la revisión programada.
 */
export type RestockTimes = Record<string, string>;

export const SIMPLE_KEY = "";
/** Un regreso de stock más antiguo que esto ya no se avisa (por ejemplo, si reactivó los emails después). */
export const RESTOCK_FRESH_DAYS = 3;

interface Stock {
  available: boolean | null;
  variants: ProductVariant[];
}

/** Agrega las opciones que estaban agotadas y ahora están disponibles. Solo cuenta un "agotado" explícito. */
export function recordRestocks(before: Stock, after: Stock, previous: RestockTimes, now: Date): RestockTimes {
  const at = now.toISOString();
  const restocks = { ...previous };
  if (before.variants.length > 0 || after.variants.length > 0) {
    const was = new Map(before.variants.map((v) => [v.key, v.available]));
    for (const v of after.variants) {
      if (was.get(v.key) === false && v.available === true) restocks[v.key] = at;
    }
  } else if (before.available === false && after.available === true) {
    restocks[SIMPLE_KEY] = at;
  }
  return restocks;
}

export interface RestockWatch {
  notifyOnRestock: boolean;
  lastRestockNotifiedAt: Date | null;
  excludedVariants: string[];
  createdAt: Date;
}

export interface RestockedOption {
  price: number;
  listPrice: number | null;
  /** Nombre del color, en una línea. */
  name?: string;
}

/**
 * Opciones que volvieron a tener stock y todavía no se le avisaron a este seguimiento:
 * posteriores a su último aviso de stock (o a cuando empezó a seguirlo) y recientes.
 */
export function restockedOptions(
  watch: RestockWatch,
  product: Stock & { price: number | null; listPrice: number | null; restocks: RestockTimes },
  now: Date,
): RestockedOption[] {
  if (!watch.notifyOnRestock) return [];
  const since = Math.max(
    watch.createdAt.getTime(),
    watch.lastRestockNotifiedAt?.getTime() ?? 0,
    now.getTime() - RESTOCK_FRESH_DAYS * 24 * 60 * 60 * 1000,
  );
  const isNew = (key: string) => {
    const at = product.restocks[key];
    return at != null && new Date(at).getTime() > since;
  };

  if (product.variants.length > 0) {
    return includedVariants(product.variants, watch.excludedVariants)
      .filter((v) => v.available === true && isNew(v.key))
      .map((v) => ({ price: v.price, listPrice: v.listPrice, name: v.name }));
  }
  if (product.available === true && product.price != null && isNew(SIMPLE_KEY)) {
    return [{ price: product.price, listPrice: product.listPrice }];
  }
  return [];
}
