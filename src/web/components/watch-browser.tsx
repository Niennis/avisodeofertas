"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ProductGroup } from "@/core/domain/group";
import type { WatchWithProduct } from "@/core/domain/watch";
import {
  applyFilters,
  DEFAULT_FILTERS,
  entryWatches,
  filtersToQuery,
  hasActiveFilters,
  isDeal,
  parseFilters,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  storeCounts,
  toEntries,
  type ListEntry,
  type SortOrder,
  type StatusFilter,
  type WatchFilters,
} from "../watch-filters";
import { GroupCard } from "./group-card";
import { cardGridClass, WatchCard } from "./watch-card";

/** Con pocos productos los filtros solo estorban. */
const MIN_FOR_FILTERS = 4;
/** Cuántas tarjetas se agregan en cada tanda al hacer scroll. */
const PAGE_SIZE = 24;

export function WatchBrowser({
  watches,
  groups,
  emailNotifications,
}: {
  watches: WatchWithProduct[];
  groups: ProductGroup[];
  emailNotifications: boolean;
}) {
  const entries = toEntries(watches, groups);
  // Se leen de la URL del navegador (no del servidor) para que sobrevivan al volver atrás.
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => parseFilters(Object.fromEntries(searchParams)));
  const [visible, setVisible] = useState(PAGE_SIZE);

  function update(change: Partial<WatchFilters>) {
    const next = { ...filters, ...change };
    setFilters(next);
    setVisible(PAGE_SIZE);
    // Se guarda en la URL sin recargar, para conservar los filtros al volver desde un producto.
    const query = filtersToQuery(next);
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  const showFilters = entries.length >= MIN_FOR_FILTERS;
  const active = showFilters ? filters : DEFAULT_FILTERS;
  const results = applyFilters(entries, active);
  // En la vista por defecto se separan las ofertas; con filtros u otro orden, una sola lista.
  const grouped = active.estado === "todos" && active.orden === "recientes";
  const deals = grouped ? results.filter(isDeal) : [];
  const others = grouped ? results.filter((w) => !isDeal(w)) : results;
  // Las tandas recorren primero las ofertas y luego el resto.
  const visibleDeals = deals.slice(0, visible);
  const visibleOthers = others.slice(0, Math.max(0, visible - deals.length));
  const remaining = results.length - visibleDeals.length - visibleOthers.length;

  return (
    <div className="flex flex-col gap-6">
      {showFilters && <FilterBar entries={entries} filters={filters} onChange={update} />}

      {showFilters && hasActiveFilters(filters) && (
        <p className="-mt-2 text-sm text-muted" aria-live="polite">
          {results.length === 1 ? "1 producto" : `${results.length} productos`} de {entries.length}
          {" · "}
          <button type="button" onClick={() => update(DEFAULT_FILTERS)} className="font-medium text-ink underline underline-offset-4">
            Quitar filtros
          </button>
        </p>
      )}

      {results.length === 0 ? (
        <p className="text-muted">
          Ningún producto coincide con estos filtros.{" "}
          <button type="button" onClick={() => update(DEFAULT_FILTERS)} className="font-medium text-ink underline underline-offset-4">
            Ver todos
          </button>
        </p>
      ) : grouped ? (
        <>
          <WatchGrid
            title="En oferta ahora"
            total={deals.length}
            entries={visibleDeals}
            emailNotifications={emailNotifications}
          />
          <WatchGrid
            title={deals.length ? "Sin oferta por ahora" : "Siguiendo"}
            total={others.length}
            entries={visibleOthers}
            emailNotifications={emailNotifications}
          />
        </>
      ) : (
        <WatchGrid entries={visibleOthers} emailNotifications={emailNotifications} />
      )}

      {remaining > 0 && <LoadMore remaining={remaining} onMore={() => setVisible((v) => v + PAGE_SIZE)} />}
    </div>
  );
}

function FilterBar({
  entries,
  filters,
  onChange,
}: {
  entries: ListEntry[];
  filters: WatchFilters;
  onChange: (change: Partial<WatchFilters>) => void;
}) {
  const stores = storeCounts(entries);
  const hasProblems = entries.flatMap(entryWatches).some((w) => w.product.lastError != null);
  const statuses = (Object.keys(STATUS_OPTIONS) as StatusFilter[]).filter(
    (status) => status !== "problemas" || hasProblems || filters.estado === "problemas",
  );

  return (
    <search className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Buscar por nombre o tienda"
            className="field"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <label>
            <span className="sr-only">Tienda</span>
            <select
              value={filters.tienda ?? ""}
              onChange={(e) => onChange({ tienda: e.target.value || null })}
              className="field sm:w-44"
            >
              <option value="">Todas las tiendas</option>
              {stores.map(({ store, count }) => (
                <option key={store} value={store}>
                  {store} ({count})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Ordenar por</span>
            <select
              value={filters.orden}
              onChange={(e) => onChange({ orden: e.target.value as SortOrder })}
              className="field sm:w-52"
            >
              {(Object.entries(SORT_OPTIONS) as [SortOrder, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Estado</legend>
        {statuses.map((status) => (
          <label key={status}>
            <input
              type="radio"
              name="estado"
              value={status}
              checked={filters.estado === status}
              onChange={() => onChange({ estado: status })}
              className="sr-only"
            />
            <span className="chip">
              {STATUS_OPTIONS[status]}
            </span>
          </label>
        ))}
      </fieldset>
    </search>
  );
}

function WatchGrid({
  title,
  total,
  entries,
  emailNotifications,
}: {
  title?: string;
  total?: number;
  entries: ListEntry[];
  emailNotifications: boolean;
}) {
  if (entries.length === 0) return null;
  return (
    <section>
      {title && (
        <h2 className="mb-5 text-lg font-bold">
          {title} <span className="font-normal text-muted">({total})</span>
        </h2>
      )}
      <ul className={cardGridClass}>
        {entries.map((entry) =>
          entry.kind === "watch" ? (
            <WatchCard key={entry.id} watch={entry.watch} emailNotifications={emailNotifications} />
          ) : (
            <GroupCard key={entry.id} group={entry.group} members={entry.members} />
          ),
        )}
      </ul>
    </section>
  );
}

/**
 * Agrega la siguiente tanda cuando el final de la lista se acerca a la pantalla.
 * El botón queda como alternativa para teclado o si el navegador no soporta la detección.
 */
function LoadMore({ remaining, onMore }: { remaining: number; onMore: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMoreRef = useRef(onMore);

  useEffect(() => {
    onMoreRef.current = onMore;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && onMoreRef.current(), {
      rootMargin: "600px 0px",
    });
    observer.observe(element);
    return () => observer.disconnect();
    // Se vuelve a observar con cada tanda: si el final sigue visible, carga otra.
  }, [remaining]);

  return (
    <div ref={ref} className="flex justify-center">
      <button type="button" onClick={onMore} className="btn btn-quiet">
        Mostrar más ({remaining})
      </button>
    </div>
  );
}
