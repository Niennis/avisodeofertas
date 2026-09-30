import { DomainError, NotFoundError } from "@/core/domain/errors";
import { MIN_GROUP_SIZE, type GroupWithMembers, type ProductGroup } from "@/core/domain/group";
import { sameProductUrl } from "@/core/domain/product-url";
import type { WatchWithProduct } from "@/core/domain/watch";
import type { GroupRepository } from "../ports/group-repository";
import type { WatchRepository } from "../ports/watch-repository";
import type { WatchService } from "./watches";

const MAX_NAME_LENGTH = 120;

export interface GroupDeps {
  groups: GroupRepository;
  watches: WatchRepository;
  watchService: WatchService;
}

/** Grupos de "mismo producto en varias tiendas". */
export class GroupService {
  constructor(private readonly deps: GroupDeps) {}

  async list(userId: string): Promise<ProductGroup[]> {
    return this.deps.groups.listByUser(userId);
  }

  async detail(userId: string, groupId: string): Promise<GroupWithMembers> {
    const group = await this.deps.groups.findForUser(userId, groupId);
    if (!group) throw new NotFoundError("No encontramos ese grupo.");
    const members = (await this.deps.watches.listByUser(userId)).filter((w) => w.groupId === groupId);
    return { ...group, members };
  }

  /**
   * Junta varios seguimientos en un grupo. Si alguno ya estaba en un grupo, los demás se suman
   * a ese (y si había varios grupos, se fusionan en el primero). Devuelve el id del grupo.
   */
  async group(userId: string, watchIds: string[]): Promise<string> {
    const mine = await this.deps.watches.listByUser(userId);
    const selected = [...new Set(watchIds)].map((id) => mine.find((w) => w.id === id));
    if (selected.some((w) => !w)) throw new NotFoundError("No encontramos uno de esos productos en tu lista.");
    const watches = selected as WatchWithProduct[];

    const existingGroups = [...new Set(watches.map((w) => w.groupId).filter((id): id is string => id != null))];
    const members = new Set([...watches.map((w) => w.id), ...mine.filter((w) => w.groupId && existingGroups.includes(w.groupId)).map((w) => w.id)]);
    if (members.size < MIN_GROUP_SIZE) throw new DomainError("Elige al menos otro producto para agrupar.");

    const groupId = existingGroups[0] ?? (await this.deps.groups.create(userId, defaultName(watches[0]))).id;
    await this.deps.watches.setGroup([...members], groupId);
    for (const other of existingGroups.slice(1)) await this.deps.groups.delete(other);
    return groupId;
  }

  /**
   * "Agregar otra tienda": sigue el enlace (o reutiliza el seguimiento si ya existía)
   * y lo junta con `anchorWatchId`. Copia las condiciones de aviso del producto de origen.
   */
  async addStore(userId: string, anchorWatchId: string, url: string): Promise<{ groupId: string; name: string }> {
    const mine = await this.deps.watches.listByUser(userId);
    const anchor = mine.find((w) => w.id === anchorWatchId);
    if (!anchor) throw new NotFoundError("No encontramos ese producto en tu lista.");

    let otherId = mine.find((w) => sameProductUrl(w.product.url, url))?.id;
    if (otherId === anchor.id) throw new DomainError("Ese enlace es el mismo producto; pega el de otra tienda.");
    if (!otherId) {
      const settings = {
        notifyOnSale: anchor.notifyOnSale,
        targetPrice: anchor.targetPrice,
        notifyOnRestock: anchor.notifyOnRestock,
      };
      const result = await this.deps.watchService.add(userId, url, settings, "separate");
      if (result.status === "line-has-colors") {
        throw new DomainError(`Ese enlace es la línea ${result.name}, con colores que ya sigues por separado. Agrégala desde el formulario principal.`);
      }
      if (result.status !== "added") throw new DomainError("No pudimos agregar ese enlace.");
      otherId = result.watchId;
    }

    const groupId = await this.group(userId, [anchor.id, otherId]);
    const group = await this.deps.groups.findForUser(userId, groupId);
    return { groupId, name: group!.name };
  }

  async rename(userId: string, groupId: string, name: string): Promise<void> {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) throw new DomainError("Escribe un nombre para el grupo.");
    if (clean.length > MAX_NAME_LENGTH) throw new DomainError(`El nombre puede tener hasta ${MAX_NAME_LENGTH} caracteres.`);
    await this.detail(userId, groupId);
    await this.deps.groups.rename(groupId, clean);
  }

  /** Deshace el grupo: cada tienda vuelve a ser una tarjeta propia. */
  async ungroup(userId: string, groupId: string): Promise<void> {
    await this.detail(userId, groupId);
    await this.deps.groups.delete(groupId);
  }

  /** Saca una tienda del grupo. Devuelve `false` si el grupo quedó deshecho por tener una sola tienda. */
  async removeMember(userId: string, groupId: string, watchId: string): Promise<boolean> {
    const group = await this.detail(userId, groupId);
    if (!group.members.some((w) => w.id === watchId)) throw new NotFoundError("Ese producto no está en el grupo.");
    await this.deps.watches.setGroup([watchId], null);
    return dissolveIfTooSmall(this.deps, groupId, group.members.length - 1);
  }
}

/** Un grupo con menos de dos tiendas no tiene sentido: se deshace. Devuelve si sigue existiendo. */
export async function dissolveIfTooSmall(
  deps: Pick<GroupDeps, "groups">,
  groupId: string,
  remaining: number,
): Promise<boolean> {
  if (remaining >= MIN_GROUP_SIZE) return true;
  await deps.groups.delete(groupId);
  return false;
}

function defaultName(watch: WatchWithProduct): string {
  return watch.product.name.slice(0, MAX_NAME_LENGTH);
}
