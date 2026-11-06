import { DomainError } from "@/core/domain/errors";
import { normalizeEmail } from "@/core/domain/user";
import type { Clock } from "../ports/clock";
import type { GroupRepository } from "../ports/group-repository";
import type { ProductRepository } from "../ports/product-repository";
import type { SessionRepository } from "../ports/session-repository";
import type { UserRepository } from "../ports/user-repository";
import type { WatchRepository } from "../ports/watch-repository";
import type { Session } from "./auth";

/** Cuánto dura una cuenta demo antes de borrarse. */
export const DEMO_HOURS = 24;
/** Productos que se pueden agregar en la demo, además de los de ejemplo. */
export const DEMO_EXTRA_PRODUCTS = 5;

export interface DemoDeps {
  users: UserRepository;
  sessions: SessionRepository;
  watches: WatchRepository;
  groups: GroupRepository;
  products: Pick<ProductRepository, "deleteOrphans">;
  clock: Clock;
  /** Cuenta cuyos productos (y grupos) se copian como ejemplo. Sin ella, la demo está desactivada. */
  templateEmail: string | null;
}

/**
 * "Probar la demo": cada visitante recibe su propia cuenta temporal con productos de ejemplo,
 * sin contraseña y sin emails. Puede agregar y borrar lo que quiera sin afectar a nadie,
 * y la cuenta se borra sola después de un día.
 */
export class DemoService {
  constructor(private readonly deps: DemoDeps) {}

  get enabled(): boolean {
    return this.deps.templateEmail != null;
  }

  async start(): Promise<Session> {
    const { users, sessions, watches, groups, clock, templateEmail } = this.deps;
    const template = templateEmail ? await users.findByEmailWithPassword(normalizeEmail(templateEmail)) : null;
    if (!template) throw new DomainError("La demo no está disponible en este momento.");

    const examples = await watches.listByUser(template.id);
    const expiresAt = new Date(clock.now().getTime() + DEMO_HOURS * 60 * 60 * 1000);
    const demo = await users.createDemo({
      // Dominio reservado que no existe: ningún email de la app puede llegar a alguien real.
      email: `demo-${crypto.randomUUID()}@demo.invalid`,
      expiresAt,
      watchLimit: examples.length + DEMO_EXTRA_PRODUCTS,
    });

    // Los grupos de "mismo producto en varias tiendas" se copian con su nombre.
    const templateGroups = new Map((await groups.listByUser(template.id)).map((g) => [g.id, g.name]));
    const newGroupIds = new Map<string, string>();
    for (const example of examples) {
      const watch = await watches.create(demo.id, example.productId, {
        targetPrice: example.targetPrice,
        notifyOnSale: example.notifyOnSale,
        notifyOnRestock: example.notifyOnRestock,
      });
      if (example.excludedVariants.length > 0) await watches.setExcludedVariants(watch.id, example.excludedVariants);
      const groupName = example.groupId ? templateGroups.get(example.groupId) : undefined;
      if (example.groupId && groupName) {
        let groupId = newGroupIds.get(example.groupId);
        if (!groupId) {
          groupId = (await groups.create(demo.id, groupName)).id;
          newGroupIds.set(example.groupId, groupId);
        }
        await watches.setGroup([watch.id], groupId);
      }
    }

    // La sesión dura lo mismo que la cuenta.
    return { token: await sessions.create(demo.id, expiresAt), expiresAt };
  }

  /** Al salir de la demo se borra la cuenta de inmediato: no hay forma de volver a entrar. */
  async end(userId: string): Promise<void> {
    await this.deps.users.deleteDemo(userId);
    await this.deps.products.deleteOrphans();
  }

  /** Borra las cuentas demo vencidas y los productos que solo seguían ellas. Lo llama el cron. */
  async cleanup(): Promise<number> {
    const deleted = await this.deps.users.deleteExpiredDemos(this.deps.clock.now());
    if (deleted > 0) await this.deps.products.deleteOrphans();
    return deleted;
  }
}
