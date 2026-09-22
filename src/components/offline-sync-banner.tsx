'use client';

import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/components/toast';
import { useBusinessAuth } from '@/lib/business-auth-context';
import {
  discardMutation,
  getOpenMutations,
  onPendingChanged,
  retryMutation,
  type PendingMutation,
} from '@/lib/offline/db';
import { syncPendingMutations } from '@/lib/offline/sync';
import { formatMoney } from '@/lib/format';

function describe(mutation: PendingMutation): string {
  const where = mutation.shop_name ? ` — ${mutation.shop_name}` : '';
  if (mutation.type === 'delivery') return `Delivery of ${mutation.payload.quantity}${where}`;
  return `Payment of ${formatMoney(mutation.payload.amount)}${where}`;
}

// Shows deliveries/payments that were saved offline and are waiting to sync,
// and runs the sync whenever the device comes back online.
export function OfflineSyncBanner() {
  const { activeBusinessId } = useBusinessAuth();
  const toast = useToast();
  const [items, setItems] = useState<PendingMutation[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeBusinessId) return setItems([]);
    try {
      setItems(await getOpenMutations(activeBusinessId));
    } catch {
      setItems([]);
    }
  }, [activeBusinessId]);

  const sync = useCallback(async () => {
    if (!activeBusinessId || !navigator.onLine) return;
    try {
      const result = await syncPendingMutations(activeBusinessId);
      if (result.succeeded > 0) {
        toast.show(`Synced ${result.succeeded} offline ${result.succeeded === 1 ? 'entry' : 'entries'}`);
      }
    } catch {
      // Leave queued; it will retry on the next trigger.
    }
    await refresh();
  }, [activeBusinessId, refresh, toast]);

  useEffect(() => {
    void refresh();
    void sync();
    const off = onPendingChanged(() => void refresh());
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    return () => {
      off();
      window.removeEventListener('online', onOnline);
    };
  }, [refresh, sync]);

  if (items.length === 0) return null;

  const failed = items.filter((i) => i.status === 'failed').length;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-3 lg:px-6">
      <div className="rounded-sm bg-warning-soft p-3 text-sm text-warning">
        <button type="button" className="flex w-full items-center justify-between text-left font-medium" onClick={() => setOpen((o) => !o)}>
          <span>
            {items.length} {items.length === 1 ? 'entry is' : 'entries are'} waiting to sync
            {failed > 0 ? ` (${failed} failed)` : ''}
          </span>
          <span className="text-xs underline">{open ? 'Hide' : 'Details'}</span>
        </button>
        {open ? (
          <ul className="mt-2 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-sm bg-surface p-2 text-fg">
                <span className="min-w-0">
                  <span className="block truncate">{describe(item)}</span>
                  {item.status === 'failed' ? (
                    <span className="block text-xs text-danger">{item.error_message}</span>
                  ) : (
                    <span className="block text-xs text-muted">{item.status === 'syncing' ? 'Syncing…' : 'Waiting'}</span>
                  )}
                </span>
                <span className="flex shrink-0 gap-3 text-xs font-bold">
                  {item.status === 'failed' ? (
                    <button type="button" className="text-primary" onClick={() => void retryMutation(item.id!).then(sync)}>
                      Retry
                    </button>
                  ) : null}
                  <button type="button" className="text-danger" onClick={() => void discardMutation(item.id!)}>
                    Discard
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
