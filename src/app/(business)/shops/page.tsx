'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { AccordionSection } from '@/components/accordion-section';
import { BackToTopButton } from '@/components/back-to-top-button';
import { Badge } from '@/components/badge';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { FormInput } from '@/components/form-input';
import { Icon } from '@/components/icon';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { ScreenHeader } from '@/components/screen-header';
import { ShopThumbnail } from '@/components/shop-thumbnail';
import { Skeleton, SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { callPhone } from '@/lib/call-phone';
import { getCollapsedAreas, setCollapsedAreas } from '@/lib/collapsed-areas-storage';
import { getErrorMessage } from '@/lib/error-message';
import { isFresh, useCachedState } from '@/lib/query-cache';
import { getShopBalances, listShops } from '@/lib/shops-api';
import { getSignedPhotoUrls } from '@/lib/upload-photo';
import type { Shop } from '@/types/catalog';

type ShopFilter = 'active' | 'balance';

const FILTER_LABELS: Record<ShopFilter, string> = {
  active: 'Active shops',
  balance: 'Shops with balance',
};

interface AreaGroup {
  area: string;
  shops: Shop[];
}

function groupByArea(shops: Shop[]): AreaGroup[] {
  const areas = new Map<string, Shop[]>();
  for (const shop of shops) {
    const key = shop.area?.trim() || 'Other';
    if (!areas.has(key)) areas.set(key, []);
    areas.get(key)!.push(shop);
  }
  return Array.from(areas.entries()).map(([area, areaShops]) => ({ area, shops: areaShops }));
}

function matchesShopQuery(shop: Shop, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    shop.name.toLowerCase().includes(q) ||
    (shop.area?.toLowerCase().includes(q) ?? false) ||
    (shop.address?.toLowerCase().includes(q) ?? false)
  );
}

function ShopsList() {
  const router = useRouter();
  const { activeBusinessId, can } = useBusinessAuth();
  const filter = useSearchParams().get('filter');
  const activeFilter: ShopFilter | null = filter === 'active' || filter === 'balance' ? filter : null;

  const shopsKey = activeBusinessId ? `shops:${activeBusinessId}` : null;
  const [shops, setShops] = useCachedState<Shop[] | null>(shopsKey, null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Only populated when the 'balance' filter is on — ids of shops with an
  // outstanding balance > 0 (same set the Overview's stats are built from).
  const [balanceShopIds, setBalanceShopIds] = useState<Set<string> | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [collapsedAreas, setCollapsedAreasState] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      setShops(await listShops(activeBusinessId));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load shops.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  useFocusEffect(
    useCallback(() => {
      if (!isFresh(shopsKey)) load();
    }, [load, shopsKey]),
  );

  useEffect(() => {
    if (activeFilter !== 'balance' || !shops || !activeBusinessId) {
      setBalanceShopIds(null);
      setBalanceError(null);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    setBalanceError(null);
    getShopBalances(activeBusinessId)
      .then((results) => {
        if (!cancelled) setBalanceShopIds(new Set(results.filter((r) => r.balance > 0).map((r) => r.shop_id)));
      })
      .catch((err) => {
        if (cancelled) return;
        setBalanceShopIds(new Set());
        setBalanceError(getErrorMessage(err, 'Could not load balances for this filter.'));
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeFilter, shops, activeBusinessId]);

  useEffect(() => {
    if (!shops || shops.length === 0) {
      setPhotoUrls(new Map());
      return;
    }
    let cancelled = false;
    const paths = [...new Set(shops.map((s) => s.photo_path).filter((p): p is string => !!p))];
    getSignedPhotoUrls('shop-photos', paths)
      .then((urls) => {
        if (!cancelled) setPhotoUrls(urls);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shops]);

  useEffect(() => {
    if (!activeBusinessId) return;
    let cancelled = false;
    getCollapsedAreas('shops', activeBusinessId).then((areas) => {
      if (!cancelled) setCollapsedAreasState(new Set(areas));
    });
    return () => {
      cancelled = true;
    };
  }, [activeBusinessId]);

  function toggleArea(area: string) {
    setCollapsedAreasState((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area);
      else next.add(area);
      if (activeBusinessId) void setCollapsedAreas('shops', activeBusinessId, Array.from(next));
      return next;
    });
  }

  if (!activeBusinessId) return null;

  const isFilterResolving = activeFilter === 'balance' && balanceLoading;
  const isSearching = query.trim().length > 0;
  // Grouped-by-area is for open-ended browsing; a filter or a search means
  // "show me a narrowed, flat result".
  const isFlat = isSearching || !!activeFilter;

  const filterMatchedShops = (shops ?? []).filter((shop) => {
    if (activeFilter === 'active') return shop.is_active;
    if (activeFilter === 'balance') return balanceShopIds?.has(shop.id) ?? false;
    return true;
  });
  const visibleShops = filterMatchedShops.filter((shop) => matchesShopQuery(shop, query));
  const groups = shops && !isFlat ? groupByArea(shops) : [];

  function renderShopRow(shop: Shop) {
    return (
      <div key={shop.id} className="rounded-lg border border-line bg-surface px-4">
        <ListRow
          className="!border-b-0"
          onClick={() => router.push(`/shops/${shop.id}`)}
          leading={<ShopThumbnail uri={shop.photo_path ? photoUrls.get(shop.photo_path) : null} name={shop.name} />}
          title={shop.name}
          subtitle={[shop.area, shop.phone].filter(Boolean).join(' · ') || undefined}
          trailing={
            <span className="flex items-center gap-2">
              {!shop.is_active ? <Badge label="Inactive" /> : null}
              {shop.phone ? (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Call ${shop.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    callPhone(shop.phone!);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      callPhone(shop.phone!);
                    }
                  }}
                  className="rounded-full p-2 text-primary hover:bg-primary-soft">
                  <Icon name="call-outline" size={22} />
                </span>
              ) : null}
            </span>
          }
        />
      </div>
    );
  }

  return (
    <>
      <ScreenHeader
        title="Shops"
        overflowActions={[
          { icon: 'pricetags-outline', label: 'Products', onPress: () => router.push('/shops/products') },
          { icon: 'swap-vertical-outline', label: 'Import/Export', onPress: () => router.push('/shops/import-export') },
        ]}
      />
      <Page>
        <FormInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by shop or area"
        />
        {isSearching ? (
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted">
              {visibleShops.length} shop{visibleShops.length === 1 ? '' : 's'} match &quot;{query.trim()}&quot;
            </p>
            <button type="button" onClick={() => setQuery('')} className="text-sm font-bold text-primary">
              Clear
            </button>
          </div>
        ) : null}

        {activeFilter ? (
          <div className="flex items-center justify-between rounded-md bg-primary-soft px-4 py-2 text-sm font-bold text-primary">
            <span>Filter: {FILTER_LABELS[activeFilter]}</span>
            <button type="button" onClick={() => router.replace('/shops')}>
              Clear
            </button>
          </div>
        ) : null}

        {shops === null && !loadError ? <SkeletonRows count={7} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}
        {balanceError ? <MessageBox tone="danger" message={balanceError} /> : null}
        {isFilterResolving ? <Skeleton height={48} /> : null}

        {shops !== null && shops.length === 0 ? (
          <EmptyState
            icon="storefront-outline"
            title="No shops yet"
            message="Add your first shop to start recording deliveries and payments."
            actionLabel="Add shop"
            onAction={() => router.push('/shops/new')}
          />
        ) : null}

        {shops !== null && shops.length > 0 && !isFilterResolving && isFlat && visibleShops.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title={isSearching ? 'No results' : 'No shops match this filter'}
            message={isSearching ? `No shops match "${query.trim()}".` : undefined}
          />
        ) : null}

        {!isFilterResolving && isFlat ? <div className="grid gap-2 lg:grid-cols-2">{visibleShops.map(renderShopRow)}</div> : null}

        {!isFilterResolving && !isFlat
          ? groups.map((group) => {
              const activeCount = group.shops.filter((s) => s.is_active).length;
              return (
                <AccordionSection
                  key={group.area}
                  title={group.area}
                  summary={`${group.shops.length} shop${group.shops.length === 1 ? '' : 's'} · ${activeCount} active`}
                  expanded={!collapsedAreas.has(group.area)}
                  onToggle={() => toggleArea(group.area)}>
                  <div className="grid gap-2 lg:grid-cols-2">{group.shops.map(renderShopRow)}</div>
                </AccordionSection>
              );
            })
          : null}
      </Page>
      {can('manage_shops') ? (
        <Fab label="Add shop" onPress={() => router.push('/shops/new')} />
      ) : null}
      <BackToTopButton />
    </>
  );
}

export default function ShopsListPage() {
  return (
    <Suspense fallback={null}>
      <ShopsList />
    </Suspense>
  );
}
