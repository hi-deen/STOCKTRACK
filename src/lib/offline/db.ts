import Dexie, { type Table } from "dexie";
import type { OperationsShopRow, Product } from "@/types/catalog";
import type { ProductUnit } from "@/types/stock";
import type { RecordDeliveryInput, RecordPaymentInput } from "@/lib/operations-api";

// The PWA's offline layer. Only the fast daily-route actions work offline:
// the Today list (read from the last snapshot) and recording deliveries and
// payments (queued here, replayed through the same API calls when back
// online). Everything else needs a connection.

export type CachedRow<T> = T & { business_id: string; cached_at: string };

export type PendingMutation =
  | {
      id?: number;
      business_id: string;
      type: "delivery";
      payload: RecordDeliveryInput;
      shop_name?: string;
      created_at: string;
      status: "pending" | "syncing" | "failed";
      error_message?: string | null;
    }
  | {
      id?: number;
      business_id: string;
      type: "payment";
      payload: RecordPaymentInput;
      shop_name?: string;
      created_at: string;
      status: "pending" | "syncing" | "failed";
      error_message?: string | null;
    };

class OfflineDistroDB extends Dexie {
  operationsCache!: Table<CachedRow<OperationsShopRow>, [string, string]>;
  productsCache!: Table<CachedRow<Product>, [string, string]>;
  unitsCache!: Table<CachedRow<ProductUnit>, [string, string]>;
  pendingMutations!: Table<PendingMutation, number>;
  syncMeta!: Table<{ business_id: string; last_synced_at: string | null }, string>;

  constructor() {
    super("distro-offline");
    this.version(1).stores({
      operationsCache: "[business_id+shop_id], business_id",
      productsCache: "[business_id+id], business_id",
      unitsCache: "[business_id+id], business_id, product_id",
      pendingMutations: "++id, business_id, status, created_at",
      syncMeta: "business_id",
    });
  }
}

let db: OfflineDistroDB | null = null;

// Dexie touches IndexedDB, which only exists in the browser.
export function offlineDb(): OfflineDistroDB {
  if (!db) {
    db = new OfflineDistroDB();
    // The pre-redesign PWA used a different database; drop it once.
    void Dexie.delete("stocktrack-offline").catch(() => undefined);
  }
  return db;
}

export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return /network|failed to fetch|fetch failed|load failed|offline|socket|timeout/i.test(message);
}

export async function clearOfflineData() {
  const d = offlineDb();
  await Promise.all([
    d.operationsCache.clear(),
    d.productsCache.clear(),
    d.unitsCache.clear(),
    d.pendingMutations.clear(),
    d.syncMeta.clear(),
  ]);
}

async function replaceBusinessRows<T extends { business_id: string }>(
  table: Table<T, [string, string]>,
  businessId: string,
  rows: T[],
) {
  await table.where("business_id").equals(businessId).delete();
  if (rows.length > 0) await table.bulkPut(rows);
}

export async function cacheOperations(businessId: string, rows: OperationsShopRow[]) {
  const cachedAt = new Date().toISOString();
  const d = offlineDb();
  await replaceBusinessRows(
    d.operationsCache,
    businessId,
    rows.map((row) => ({ ...row, business_id: businessId, cached_at: cachedAt })),
  );
  await d.syncMeta.put({ business_id: businessId, last_synced_at: cachedAt });
}

export async function getCachedOperations(
  businessId: string,
): Promise<{ rows: OperationsShopRow[]; lastSyncedAt: string | null }> {
  const d = offlineDb();
  const [rows, meta] = await Promise.all([
    d.operationsCache.where("business_id").equals(businessId).toArray(),
    d.syncMeta.get(businessId),
  ]);
  return { rows, lastSyncedAt: meta?.last_synced_at ?? null };
}

export async function cacheProducts(businessId: string, products: Product[]) {
  const cachedAt = new Date().toISOString();
  await replaceBusinessRows(
    offlineDb().productsCache,
    businessId,
    products.map((p) => ({ ...p, business_id: businessId, cached_at: cachedAt })),
  );
}

export async function getCachedProducts(businessId: string): Promise<Product[]> {
  return offlineDb().productsCache.where("business_id").equals(businessId).toArray();
}

export async function cacheProductUnits(businessId: string, productId: string, units: ProductUnit[]) {
  const cachedAt = new Date().toISOString();
  const d = offlineDb();
  await d.unitsCache.where("product_id").equals(productId).delete();
  if (units.length > 0) {
    await d.unitsCache.bulkPut(units.map((u) => ({ ...u, business_id: businessId, cached_at: cachedAt })));
  }
}

export async function getCachedProductUnits(productId: string): Promise<ProductUnit[]> {
  return offlineDb().unitsCache.where("product_id").equals(productId).toArray();
}

export async function queueMutation(mutation: Omit<PendingMutation, "id" | "created_at" | "status">) {
  await offlineDb().pendingMutations.add({
    ...mutation,
    created_at: new Date().toISOString(),
    status: "pending",
  } as PendingMutation);
  notifyPendingChanged();
}

export async function getOpenMutations(businessId: string): Promise<PendingMutation[]> {
  return offlineDb().pendingMutations.where("business_id").equals(businessId).sortBy("created_at");
}

export async function retryMutation(id: number) {
  await offlineDb().pendingMutations.update(id, { status: "pending", error_message: null });
  notifyPendingChanged();
}

export async function discardMutation(id: number) {
  await offlineDb().pendingMutations.delete(id);
  notifyPendingChanged();
}

// Lightweight pub/sub so the banner and the Today list refresh when the
// queue changes, without polling.
const PENDING_EVENT = "distro:pending-changed";
export function notifyPendingChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PENDING_EVENT));
}
export function onPendingChanged(listener: () => void) {
  window.addEventListener(PENDING_EVENT, listener);
  return () => window.removeEventListener(PENDING_EVENT, listener);
}
