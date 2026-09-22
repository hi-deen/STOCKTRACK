'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AccordionSection } from '@/components/accordion-section';
import { BackToTopButton } from '@/components/back-to-top-button';
import { Badge } from '@/components/badge';
import { Dialog } from '@/components/bottom-sheet';
import { BusinessSwitcherModal } from '@/components/business-switcher-modal';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { FormInput } from '@/components/form-input';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { ShopThumbnail } from '@/components/shop-thumbnail';
import { SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getCollapsedAreas, setCollapsedAreas } from '@/lib/collapsed-areas-storage';
import { getDashboardStats } from '@/lib/dashboard-api';
import { getErrorMessage } from '@/lib/error-message';
import { formatMoney } from '@/lib/format';
import {
  cacheOperations,
  cacheProductUnits,
  cacheProducts,
  getCachedOperations,
  isNetworkError,
} from '@/lib/offline/db';
import { getOperationsView } from '@/lib/operations-api';
import { listProductUnits } from '@/lib/product-units-api';
import { listProducts } from '@/lib/products-api';
import { useCachedState } from '@/lib/query-cache';
import { listLowStockItems, listLowStockProducts } from '@/lib/stock-reports-api';
import { getSignedPhotoUrls } from '@/lib/upload-photo';
import type { OperationsShopRow } from '@/types/catalog';
import type { DashboardStats } from '@/types/dashboard';

type PickerMode = 'delivery' | 'payment' | null;

interface AreaGroup {
  area: string;
  shops: OperationsShopRow[];
}

function groupByArea(rows: OperationsShopRow[]): AreaGroup[] {
  const areas = new Map<string, OperationsShopRow[]>();
  for (const row of rows) {
    const key = row.area?.trim() || 'Other';
    if (!areas.has(key)) areas.set(key, []);
    areas.get(key)!.push(row);
  }
  return Array.from(areas.entries()).map(([area, shops]) => ({ area, shops }));
}

// Substring/case-insensitive across name, area, and address — all client-side
// over the single already-fetched rows, no per-shop requests involved.
function matchesQuery(shop: OperationsShopRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    shop.shop_name.toLowerCase().includes(q) ||
    (shop.area?.toLowerCase().includes(q) ?? false) ||
    (shop.address?.toLowerCase().includes(q) ?? false)
  );
}

export default function OperationsPage() {
  const router = useRouter();
  const { activeBusinessId, activeMembership, memberships, setActiveBusinessId } = useBusinessAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [summaryStats, setSummaryStats] = useCachedState<DashboardStats | null>(
    activeBusinessId ? `today-stats:${activeBusinessId}` : null,
    null,
  );
  const [lowStockCount, setLowStockCount] = useCachedState<number>(
    activeBusinessId ? `today-lowstock:${activeBusinessId}` : null,
    0,
  );
  const [rows, setRows] = useCachedState<OperationsShopRow[] | null>(
    activeBusinessId ? `today-rows:${activeBusinessId}` : null,
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offlineSince, setOfflineSince] = useState<string | null | undefined>(undefined);
  const [query, setQuery] = useState('');

  // Empty set = every area expanded, the default before a preference is stored.
  const [collapsedAreas, setCollapsedAreasState] = useState<Set<string>>(new Set());
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());

  // Warm the offline cache with what the delivery form needs (products and
  // their selling units) so deliveries can still be recorded without a signal.
  const warmOfflineCache = useCallback(async (businessId: string) => {
    try {
      const products = await listProducts(businessId);
      await cacheProducts(businessId, products);
      await Promise.all(
        products
          .filter((p) => p.is_active)
          .map(async (p) => cacheProductUnits(businessId, p.id, await listProductUnits(p.id))),
      );
    } catch {
      // Best-effort.
    }
  }, []);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const data = await getOperationsView(activeBusinessId);
      setRows(data);
      setLoadError(null);
      setOfflineSince(undefined);
      void cacheOperations(activeBusinessId, data).catch(() => undefined);
      void warmOfflineCache(activeBusinessId);
    } catch (err) {
      if (isNetworkError(err)) {
        const cached = await getCachedOperations(activeBusinessId).catch(() => null);
        if (cached && cached.rows.length > 0) {
          setRows(cached.rows);
          setOfflineSince(cached.lastSyncedAt);
          setLoadError(null);
          return;
        }
      }
      setLoadError(getErrorMessage(err, "Could not load today's operations."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, warmOfflineCache]);

  // Summary extras are best-effort: a failure just hides the summary and
  // never affects the main shop list.
  const loadSummary = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [statsData, lowItems, lowProducts] = await Promise.all([
        getDashboardStats(activeBusinessId),
        listLowStockItems(activeBusinessId),
        listLowStockProducts(activeBusinessId),
      ]);
      setSummaryStats(statsData);
      setLowStockCount(lowItems.length + lowProducts.length);
    } catch {
      setSummaryStats(null);
      setLowStockCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  const refreshAll = useCallback(() => {
    void load();
    void loadSummary();
  }, [load, loadSummary]);

  useFocusEffect(refreshAll);

  useEffect(() => {
    if (!activeBusinessId) return;
    let cancelled = false;
    getCollapsedAreas('operations', activeBusinessId).then((areas) => {
      if (!cancelled) setCollapsedAreasState(new Set(areas));
    });
    return () => {
      cancelled = true;
    };
  }, [activeBusinessId]);

  useEffect(() => {
    if (!rows || rows.length === 0) {
      setPhotoUrls(new Map());
      return;
    }
    let cancelled = false;
    const paths = [...new Set(rows.map((r) => r.photo_path).filter((p): p is string => !!p))];
    getSignedPhotoUrls('shop-photos', paths)
      .then((urls) => {
        if (!cancelled) setPhotoUrls(urls);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [rows]);

  function toggleArea(area: string) {
    setCollapsedAreasState((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      if (activeBusinessId) void setCollapsedAreas('operations', activeBusinessId, Array.from(next));
      return next;
    });
  }

  function toggleAllAreas() {
    if (!rows) return;
    const currentGroups = groupByArea(rows);
    const allExpanded = currentGroups.every((g) => !collapsedAreas.has(g.area));
    const next = allExpanded ? new Set(currentGroups.map((g) => g.area)) : new Set<string>();
    setCollapsedAreasState(next);
    if (activeBusinessId) void setCollapsedAreas('operations', activeBusinessId, Array.from(next));
  }

  function openPicker(mode: 'delivery' | 'payment') {
    setPickerQuery('');
    setPickerMode(mode);
  }

  function goRecord(mode: 'delivery' | 'payment', shop: OperationsShopRow) {
    router.push(`/operations/${mode}/${shop.shop_id}?shopName=${encodeURIComponent(shop.shop_name)}`);
  }

  function pickShop(shop: OperationsShopRow) {
    const mode = pickerMode;
    setPickerMode(null);
    if (mode) goRecord(mode, shop);
  }

  if (!activeBusinessId) return null;

  const isSearching = query.trim().length > 0;
  const matchingShops = rows ? rows.filter((shop) => matchesQuery(shop, query)) : [];
  const groups = rows && !isSearching ? groupByArea(rows) : [];
  const allAreasExpanded = groups.every((g) => !collapsedAreas.has(g.area));
  const pickerShops = rows ? rows.filter((shop) => matchesQuery(shop, pickerQuery)) : [];

  function renderShopCard(shop: OperationsShopRow) {
    return (
      <Card key={shop.shop_id} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => router.push(`/shops/${shop.shop_id}`)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <ShopThumbnail
              uri={shop.photo_path ? photoUrls.get(shop.photo_path) : null}
              name={shop.shop_name}
              size={40}
            />
            <span className="truncate text-sm font-bold">{shop.shop_name}</span>
          </button>
          <span className={`font-medium tabular-nums ${shop.balance > 0 ? 'text-danger' : 'text-success'}`}>
            {formatMoney(shop.balance)}
          </span>
        </div>

        {shop.restocked_today ? (
          <Badge
            tone="success"
            label={`Delivered today${shop.today_delivery_summary ? ` — ${shop.today_delivery_summary}` : ''}`}
          />
        ) : (
          <p className="text-sm font-medium text-muted">
            {shop.days_since_restock === null
              ? 'No deliveries yet'
              : `Last restock ${shop.days_since_restock} day${shop.days_since_restock === 1 ? '' : 's'} ago`}
          </p>
        )}

        {shop.payment_status_today !== 'none' ? (
          <p className="text-sm font-medium text-success">
            {shop.payment_status_today === 'full' ? 'Paid in full today' : 'Partial payment today'}
            {' · '}
            {formatMoney(shop.payments_today_total)}
            {shop.last_payment_method_today ? ` (${shop.last_payment_method_today})` : ''}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <PrimaryButton label="Record delivery" variant="outline" onClick={() => goRecord('delivery', shop)} />
          <PrimaryButton label="Record payment" variant="outline" onClick={() => goRecord('payment', shop)} />
        </div>
      </Card>
    );
  }

  return (
    <>
      <ScreenHeader
        title="Today"
        subtitle={activeMembership?.business_name}
        onTitlePress={memberships.length > 1 ? () => setSwitcherOpen(true) : undefined}
        primaryActions={[
          { icon: 'notifications-outline', label: 'Reminders', onPress: () => router.push('/home/reminders') },
          { icon: 'stats-chart-outline', label: 'Overview', onPress: () => router.push('/home') },
          {
            icon: allAreasExpanded ? 'contract-outline' : 'expand-outline',
            label: allAreasExpanded ? 'Collapse all areas' : 'Expand all areas',
            onPress: toggleAllAreas,
            disabled: !rows || isSearching || groups.length === 0,
          },
          { icon: 'refresh', label: 'Refresh', onPress: refreshAll },
        ]}
        overflowActions={[
          {
            icon: 'cube-outline',
            label: 'Record delivery',
            onPress: () => openPicker('delivery'),
            disabled: !rows || rows.length === 0,
          },
          {
            icon: 'cash-outline',
            label: 'Record payment',
            onPress: () => openPicker('payment'),
            disabled: !rows || rows.length === 0,
          },
        ]}
      />
      <Page>
        {offlineSince !== undefined ? (
          <MessageBox
            tone="warning"
            message={`You're offline — showing the last saved list${offlineSince ? ` (synced ${new Date(offlineSince).toLocaleString()})` : ''}. Deliveries and payments you record are saved and sync later.`}
          />
        ) : null}

        {lowStockCount > 0 ? (
          <button type="button" className="block w-full text-left" onClick={() => router.push('/stock')}>
            <MessageBox
              tone="warning"
              message={`${lowStockCount} stock item${lowStockCount === 1 ? '' : 's'} at or below reorder level — tap to view`}
            />
          </button>
        ) : null}

        {summaryStats ? (
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <p className="text-sm font-medium text-muted">Outstanding</p>
              <p className="text-sm font-bold tabular-nums text-danger">{formatMoney(summaryStats.total_outstanding)}</p>
            </Card>
            <Card>
              <p className="text-sm font-medium text-muted">Payments this month</p>
              <p className="text-sm font-bold tabular-nums text-success">
                {formatMoney(summaryStats.total_payments_this_month)}
              </p>
            </Card>
          </div>
        ) : null}

        <FormInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by shop or area"
          type="search"
        />
        {isSearching ? (
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted">
              {matchingShops.length} shop{matchingShops.length === 1 ? '' : 's'} match &quot;{query.trim()}&quot;
            </p>
            <button type="button" onClick={() => setQuery('')} className="text-sm font-bold text-primary">
              Clear
            </button>
          </div>
        ) : null}

        {rows === null && !loadError ? <SkeletonRows count={6} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {rows !== null && rows.length === 0 ? (
          <EmptyState
            icon="storefront-outline"
            title="No active shops yet"
            message="Add one from the Shops tab."
            actionLabel="Go to Shops"
            onAction={() => router.push('/shops')}
          />
        ) : null}

        {isSearching ? (
          <div className="grid gap-3 lg:grid-cols-2">{matchingShops.map(renderShopCard)}</div>
        ) : (
          groups.map((group) => {
            const visitedToday = group.shops.filter((s) => s.restocked_today).length;
            return (
              <AccordionSection
                key={group.area}
                title={group.area}
                summary={`${group.shops.length} shop${group.shops.length === 1 ? '' : 's'} · ${visitedToday}/${group.shops.length} restocked today`}
                expanded={!collapsedAreas.has(group.area)}
                onToggle={() => toggleArea(group.area)}>
                <div className="grid gap-3 lg:grid-cols-2">{group.shops.map(renderShopCard)}</div>
              </AccordionSection>
            );
          })
        )}
      </Page>
      <BackToTopButton />

      <BusinessSwitcherModal
        visible={switcherOpen}
        memberships={memberships}
        activeBusinessId={activeBusinessId}
        onSelect={(id) => void setActiveBusinessId(id)}
        onClose={() => setSwitcherOpen(false)}
      />

      <Dialog
        visible={pickerMode !== null}
        onClose={() => setPickerMode(null)}
        title={pickerMode === 'delivery' ? 'Record delivery — pick a shop' : 'Record payment — pick a shop'}>
        <FormInput
          value={pickerQuery}
          onChange={(e) => setPickerQuery(e.target.value)}
          placeholder="Search by shop or area"
          autoFocus
        />
        <div className="max-h-72 overflow-y-auto">
          {pickerShops.length === 0 ? (
            <p className="py-4 text-center text-muted">No shops match this search.</p>
          ) : (
            pickerShops.map((shop) => (
              <ListRow key={shop.shop_id} title={shop.shop_name} subtitle={shop.area ?? undefined} onClick={() => pickShop(shop)} />
            ))
          )}
        </div>
        <button type="button" onClick={() => setPickerMode(null)} className="w-full py-2 text-muted">
          Cancel
        </button>
      </Dialog>
    </>
  );
}
