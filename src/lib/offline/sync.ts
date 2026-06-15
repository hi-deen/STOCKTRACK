import { createClient } from "@/lib/supabase/client";
import { cacheOperationsSnapshot, offlineDb, type PendingMutation } from "@/lib/offline/db";
import type { Product, ShopOperationsRow } from "@/types/phase2";
import type { SupabaseClient } from "@supabase/supabase-js";

function isNetworkError(error: unknown) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /network|failed to fetch|fetch failed|offline|socket|timeout/i.test(message);
}

export async function syncPendingMutations(supabase: SupabaseClient | null, businessId: string) {
  if (!supabase || !businessId) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const pendingMutations = await offlineDb.pendingMutations.where("business_id").equals(businessId).filter((mutation) => mutation.status === "pending").sortBy("created_at");

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const mutation of pendingMutations) {
    processed += 1;
    await offlineDb.pendingMutations.update(mutation.id!, { status: "syncing", error_message: null });

    try {
      if (mutation.type === "delivery") {
        const payload = mutation.payload as Record<string, unknown>;
        const { error } = await supabase.from("stock_deliveries").insert({
          business_id: businessId,
          shop_id: payload.shop_id,
          product_id: payload.product_id,
          quantity: payload.quantity,
          unit_price: payload.unit_price,
          total_amount: payload.total_amount,
          delivery_date: payload.delivery_date,
          notes: payload.notes ?? null,
          created_by: payload.created_by ?? null,
        });

        if (error) {
          throw error;
        }
      } else if (mutation.type === "payment") {
        const payload = mutation.payload as Record<string, unknown>;
        const { error } = await supabase.from("payments").insert({
          business_id: businessId,
          shop_id: payload.shop_id,
          amount: payload.amount,
          payment_date: payload.payment_date,
          method: payload.method,
          notes: payload.notes ?? null,
          created_by: payload.created_by ?? null,
        });

        if (error) {
          throw error;
        }
      } else if (mutation.type === "reminder") {
        const payload = mutation.payload as Record<string, unknown>;
        const { error } = await supabase.from("reminders").insert({
          business_id: businessId,
          shop_id: payload.shop_id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          due_date: payload.due_date,
          created_by: payload.created_by ?? null,
        });

        if (error) {
          throw error;
        }
      }

      await offlineDb.pendingMutations.delete(mutation.id!);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      await offlineDb.pendingMutations.update(mutation.id!, {
        status: "failed",
        error_message: isNetworkError(error) ? (error instanceof Error ? error.message : String(error)) : (error as Error).message,
      });
    }
  }

  const [operationsRes, productsRes] = await Promise.all([
    supabase.rpc("get_operations_view", { business_id_input: businessId }),
    supabase.from("products").select("*").eq("business_id", businessId).order("name"),
  ]);

  if (!operationsRes.error && !productsRes.error) {
    const nextRows = (operationsRes.data ?? []) as ShopOperationsRow[];
    const nextProducts = (productsRes.data ?? []) as Product[];
    await cacheOperationsSnapshot({ businessId, rows: nextRows, products: nextProducts });
  }

  return { processed, succeeded, failed };
}

export async function triggerOfflineSync(businessId: string) {
  const supabase = createClient();
  if (!supabase || !businessId) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  return syncPendingMutations(supabase, businessId);
}
