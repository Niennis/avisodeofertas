import type { ProductGroup } from "@/core/domain/group";
import type { WatchWithProduct } from "@/core/domain/watch";
import type { GroupCandidate } from "./components/store-adder";

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

/**
 * Opciones para "agrupar con uno que ya sigues": los productos sueltos y los otros grupos
 * (representados por uno de sus miembros), sin el producto o grupo actual.
 */
export function groupCandidates(
  watches: WatchWithProduct[],
  groups: ProductGroup[],
  exclude: { watchId: string; groupId: string | null },
): GroupCandidate[] {
  const loose = watches
    .filter((w) => w.groupId == null && w.id !== exclude.watchId)
    .map((w) => ({ watchId: w.id, label: `${w.product.name} · ${w.product.store}` }));
  const otherGroups = groups
    .filter((g) => g.id !== exclude.groupId)
    .flatMap((g) => {
      const member = watches.find((w) => w.groupId === g.id);
      return member ? [{ watchId: member.id, label: `${g.name} (grupo)` }] : [];
    });
  return [...loose, ...otherGroups].sort((a, b) => collator.compare(a.label, b.label));
}
