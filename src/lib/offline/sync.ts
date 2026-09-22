import { recordDelivery, recordPayment } from "@/lib/operations-api";
import { isNetworkError, notifyPendingChanged, offlineDb } from "@/lib/offline/db";

let running = false;

// Replays queued deliveries/payments in the order they were recorded through
// the very same API calls used online (so the server-side triggers, stock
// effects and audit trail are identical). A network failure stops the run and
// leaves the rest queued; any other error marks that one item "failed" so the
// user can retry or discard it.
export async function syncPendingMutations(businessId: string) {
  if (running || !businessId) return { processed: 0, succeeded: 0, failed: 0 };
  running = true;

  const d = offlineDb();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    const queue = await d.pendingMutations
      .where("business_id")
      .equals(businessId)
      .filter((m) => m.status === "pending")
      .sortBy("created_at");

    for (const mutation of queue) {
      processed += 1;
      await d.pendingMutations.update(mutation.id!, { status: "syncing", error_message: null });
      try {
        if (mutation.type === "delivery") await recordDelivery(mutation.payload);
        else await recordPayment(mutation.payload);
        await d.pendingMutations.delete(mutation.id!);
        succeeded += 1;
      } catch (error) {
        if (isNetworkError(error)) {
          await d.pendingMutations.update(mutation.id!, { status: "pending" });
          break;
        }
        failed += 1;
        await d.pendingMutations.update(mutation.id!, {
          status: "failed",
          error_message: (error as { message?: string })?.message ?? "Could not sync this entry.",
        });
      }
    }
  } finally {
    running = false;
    notifyPendingChanged();
  }

  return { processed, succeeded, failed };
}
