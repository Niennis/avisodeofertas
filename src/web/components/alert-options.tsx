/** Campos de las condiciones de aviso, compartidos por el formulario de alta y el de edición. */
export function AlertOptions({
  notifyOnSale = true,
  targetPrice = null,
  notifyOnRestock = false,
}: {
  notifyOnSale?: boolean;
  targetPrice?: number | null;
  notifyOnRestock?: boolean;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
      <legend className="sr-only">Cuándo avisarme</legend>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="notifyOnSale" defaultChecked={notifyOnSale} className="size-4 accent-(--sale)" />
        Cuando la tienda lo rebaje
      </label>
      <label className="flex items-center gap-2 whitespace-nowrap">
        Cuando cueste $
        <input
          name="targetPrice"
          inputMode="numeric"
          defaultValue={targetPrice ?? ""}
          placeholder="opcional"
          className="field w-28 py-1.5!"
          aria-label="Precio objetivo"
        />
        o menos
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="notifyOnRestock"
          defaultChecked={notifyOnRestock}
          className="size-4 accent-(--sale)"
        />
        Cuando vuelva a haber stock
      </label>
    </fieldset>
  );
}
