import Dexie, { type Table } from "dexie";
import type { Product, ShopOperationsRow } from "@/types/phase2";

export type OperationsCacheEntry = ShopOperationsRow & {
  business_id: string;
  cached_at: string;
};

export type ProductsCacheEntry = Product & {
  business_id: string;
  cached_at: string;
};

export type PendingMutation = {
  id?: number;
  business_id: string;
  type: "delivery" | "payment" | "reminder";
  payload: Record<string, unknown>;
  created_at: string;
  status: "pending" | "syncing" | "failed";
  error_message?: string | null;
};

export type SyncMetaEntry = {
  business_id: string;
  last_synced_at: string | null;
};

class OfflineStockTrackDB extends Dexie {
  operationsCache!: Table<OperationsCacheEntry, [string, string]>;
  productsCache!: Table<ProductsCacheEntry, [string, string]>;
  pendingMutations!: Table<PendingMutation, number>;
  syncMeta!: Table<SyncMetaEntry, string>;

  constructor() {
    super("stocktrack-offline");
    this.version(1).stores({
      operationsCache: "[business_id+shop_id], business_id, cached_at",
      productsCache: "[business_id+product_id], business_id, cached_at",
      pendingMutations: "++id, business_id, status, created_at",
      syncMeta: "business_id",
    });
  }
}

export const offlineDb = new OfflineStockTrackDB();

export async function clearOfflineData() {
  await offlineDb.transaction("rw", offlineDb.operationsCache, offlineDb.productsCache, offlineDb.pendingMutations, offlineDb.syncMeta, async () => {
    await offlineDb.operationsCache.clear();
    await offlineDb.productsCache.clear();
    await offlineDb.pendingMutations.clear();
    await offlineDb.syncMeta.clear();
  });
}
