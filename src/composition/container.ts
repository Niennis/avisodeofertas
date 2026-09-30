import { ConsoleNotifier, SmtpNotifier } from "@/adapters/notifications/smtp-notifier";
import { createDatabase } from "@/adapters/persistence/drizzle/db";
import { DrizzleFailureRepository } from "@/adapters/persistence/drizzle/failure-repository";
import { DrizzleGroupRepository } from "@/adapters/persistence/drizzle/group-repository";
import { DrizzleProductRepository } from "@/adapters/persistence/drizzle/product-repository";
import { DrizzlePasswordResetRepository, DrizzleSessionRepository, DrizzleUserRepository } from "@/adapters/persistence/drizzle/user-repository";
import { DrizzleWatchRepository } from "@/adapters/persistence/drizzle/watch-repository";
import { MultiPlatformPriceReader } from "@/adapters/price-readers/multi-platform-price-reader";
import { ScryptPasswordHasher } from "@/adapters/security/scrypt-password-hasher";
import { systemClock } from "@/core/application/ports/clock";
import { AccountService } from "@/core/application/use-cases/account";
import { AdminService } from "@/core/application/use-cases/admin";
import { AuthService } from "@/core/application/use-cases/auth";
import { checkPrices } from "@/core/application/use-cases/check-prices";
import { GroupService } from "@/core/application/use-cases/groups";
import { WatchService } from "@/core/application/use-cases/watches";
import { loadConfig, type AppConfig } from "./config";

/**
 * Raíz de composición: el único lugar que conoce los adaptadores concretos.
 * Para cambiar, por ejemplo, la base de datos o el proveedor de email,
 * se reemplaza el adaptador aquí sin tocar el dominio ni los casos de uso.
 */
export async function buildContainer(config: AppConfig = loadConfig()) {
  const db = await createDatabase(config.databaseUrl);
  const products = new DrizzleProductRepository(db);
  const watches = new DrizzleWatchRepository(db);
  const users = new DrizzleUserRepository(db);
  const groups = new DrizzleGroupRepository(db);
  const failures = new DrizzleFailureRepository(db);
  const priceReader = new MultiPlatformPriceReader();
  const notifier = config.smtp ? new SmtpNotifier(config.smtp, config.appUrl) : new ConsoleNotifier();
  const clock = systemClock;
  const watchService = new WatchService({ products, failures, watches, groups, priceReader, clock });

  return {
    config,
    auth: new AuthService({
      users,
      sessions: new DrizzleSessionRepository(db),
      resets: new DrizzlePasswordResetRepository(db),
      hasher: new ScryptPasswordHasher(),
      notifier,
      clock,
      inviteCode: config.inviteCode,
    }),
    account: new AccountService(users),
    watches: watchService,
    groups: new GroupService({ groups, watches, watchService }),
    admin: new AdminService(failures, config.adminEmail),
    checkPrices: (log?: (message: string) => void) =>
      checkPrices({
        products,
        failures,
        watches,
        priceReader,
        notifier,
        clock,
        adminEmail: config.adminEmail,
        delayBetweenRequestsMs: 1500,
        log,
      }),
  };
}

export type Container = Awaited<ReturnType<typeof buildContainer>>;

// Se reutiliza entre requests (y entre recargas en desarrollo).
const globalForContainer = globalThis as unknown as { container?: Promise<Container> };

export function getContainer(): Promise<Container> {
  globalForContainer.container ??= buildContainer().catch((error) => {
    globalForContainer.container = undefined;
    throw error;
  });
  return globalForContainer.container;
}
