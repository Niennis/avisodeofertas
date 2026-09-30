import { and, asc, eq, exists, gte, notExists, sql } from "drizzle-orm";
import type { NewProduct, ProductRepository } from "@/core/application/ports/product-repository";
import type { PriceReading } from "@/core/domain/price";
import type { PriceInsight } from "@/core/domain/price-insight";
import type { PriceSnapshot, Product } from "@/core/domain/product";
import type { Database } from "./db";
import { priceSnapshots, products, watches } from "./schema";

export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Product | null> {
    const [row] = await this.db.select().from(products).where(eq(products.id, id));
    return row ?? null;
  }

  async findByUrl(url: string): Promise<Product | null> {
    const [row] = await this.db.select().from(products).where(eq(products.url, url));
    return row ?? null;
  }

  async create({ url, store, reading, checkedAt }: NewProduct): Promise<Product> {
    const [row] = await this.db
      .insert(products)
      .values({ url, store, ...readingColumns(reading), lastCheckedAt: checkedAt })
      .onConflictDoNothing({ target: products.url })
      .returning();
    // Si otra persona agregó el mismo producto al mismo tiempo, se reutiliza.
    const product = row ?? (await this.findByUrl(url));
    if (!product) throw new Error(`No se pudo crear el producto ${url}`);
    if (row) await this.insertSnapshot(row.id, reading, checkedAt);
    return product;
  }

  async recordReading(productId: string, reading: PriceReading, checkedAt: Date): Promise<void> {
    await this.db
      .update(products)
      .set({ ...readingColumns(reading), lastCheckedAt: checkedAt, lastError: null, consecutiveFailures: 0 })
      .where(eq(products.id, productId));
    await this.insertSnapshot(productId, reading, checkedAt);
  }

  async savePriceInsight(productId: string, insight: PriceInsight | null): Promise<void> {
    await this.db.update(products).set({ priceInsight: insight }).where(eq(products.id, productId));
  }

  async recordError(productId: string, error: string, checkedAt: Date): Promise<number> {
    const [row] = await this.db
      .update(products)
      .set({
        lastError: error.slice(0, 500),
        lastCheckedAt: checkedAt,
        consecutiveFailures: sql`${products.consecutiveFailures} + 1`,
      })
      .where(eq(products.id, productId))
      .returning({ failures: products.consecutiveFailures });
    return row?.failures ?? 1;
  }

  listWatched(): Promise<Product[]> {
    return this.db
      .select()
      .from(products)
      .where(exists(this.watchesOfProduct()))
      .orderBy(asc(products.url));
  }

  history(productId: string, since: Date): Promise<PriceSnapshot[]> {
    return this.db
      .select({
        price: priceSnapshots.price,
        listPrice: priceSnapshots.listPrice,
        available: priceSnapshots.available,
        checkedAt: priceSnapshots.checkedAt,
      })
      .from(priceSnapshots)
      .where(and(eq(priceSnapshots.productId, productId), gte(priceSnapshots.checkedAt, since)))
      .orderBy(asc(priceSnapshots.checkedAt));
  }

  async deleteOrphans(): Promise<number> {
    const deleted = await this.db
      .delete(products)
      .where(notExists(this.watchesOfProduct()))
      .returning({ id: products.id });
    return deleted.length;
  }

  private watchesOfProduct() {
    return this.db.select({ one: sql`1` }).from(watches).where(eq(watches.productId, products.id));
  }

  private async insertSnapshot(productId: string, reading: PriceReading, checkedAt: Date) {
    await this.db.insert(priceSnapshots).values({
      productId,
      price: reading.price,
      listPrice: reading.listPrice,
      available: reading.available,
      checkedAt,
    });
  }
}

function readingColumns(reading: PriceReading) {
  return {
    name: reading.name,
    brand: reading.brand ?? null,
    imageUrl: reading.imageUrl,
    currency: reading.currency,
    price: reading.price,
    listPrice: reading.listPrice,
    available: reading.available,
    variants: reading.variants ?? [],
  };
}
