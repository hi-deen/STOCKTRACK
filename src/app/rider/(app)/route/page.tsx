'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/badge';
import { PressableCard } from '@/components/card';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { ScreenHeader } from '@/components/screen-header';
import { Skeleton } from '@/components/skeleton';
import { getErrorMessage } from '@/lib/error-message';
import { getRiderRoute } from '@/lib/rider-api';
import { useRiderAuth } from '@/lib/rider-auth-context';
import type { RiderRouteStop } from '@/types/rider';

interface BusinessGroup {
  business_id: string;
  business_name: string;
  areas: { area: string; shops: RiderRouteStop[] }[];
}

function groupRoute(stops: RiderRouteStop[]): BusinessGroup[] {
  const businesses = new Map<string, { business_name: string; areas: Map<string, RiderRouteStop[]> }>();
  for (const stop of stops) {
    let business = businesses.get(stop.business_id);
    if (!business) {
      business = { business_name: stop.business_name, areas: new Map() };
      businesses.set(stop.business_id, business);
    }
    const areaKey = stop.area?.trim() || 'Other';
    if (!business.areas.has(areaKey)) business.areas.set(areaKey, []);
    business.areas.get(areaKey)!.push(stop);
  }
  return Array.from(businesses.entries()).map(([business_id, business]) => ({
    business_id,
    business_name: business.business_name,
    areas: Array.from(business.areas.entries()).map(([area, shops]) => ({ area, shops })),
  }));
}

export default function RiderRoutePage() {
  const router = useRouter();
  const { token } = useRiderAuth();

  const [stops, setStops] = useState<RiderRouteStop[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setStops(await getRiderRoute(token));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Could not load today's route."));
    }
  }, [token]);

  // Load on mount and again whenever the tab regains focus, so a delivery
  // recorded on the next screen shows up immediately on return.
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const groups = stops ? groupRoute(stops) : [];

  return (
    <>
      <ScreenHeader
        title="Today's route"
        back
        primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]}
      />
      <Page narrow>
        {stops === null && !loadError ? <Skeleton height={80} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}
        {stops !== null && stops.length === 0 ? <p className="text-muted">No shops assigned to you today.</p> : null}

        {groups.map((business) => (
          <div key={business.business_id} className="space-y-3">
            <h2 className="text-sm font-bold">{business.business_name}</h2>
            {business.areas.map((areaGroup) => (
              <div key={areaGroup.area} className="space-y-2">
                <SectionLabel>{areaGroup.area}</SectionLabel>
                {areaGroup.shops.map((shop) => (
                  <PressableCard
                    key={shop.shop_id}
                    onClick={() =>
                      router.push(
                        `/rider/delivery/${shop.shop_id}?businessId=${encodeURIComponent(shop.business_id)}&shopName=${encodeURIComponent(shop.shop_name)}`,
                      )
                    }
                    className="space-y-1">
                    <span className="block text-sm font-bold">{shop.shop_name}</span>
                    {shop.usual_order_summary ? (
                      <span className="block text-muted">Usual order: {shop.usual_order_summary}</span>
                    ) : null}
                    {shop.restocked_today ? (
                      <Badge
                        label={`Delivered today${shop.today_delivery_summary ? ` — ${shop.today_delivery_summary}` : ''}`}
                        tone="success"
                      />
                    ) : (
                      <span className="block text-muted">Not delivered yet today</span>
                    )}
                  </PressableCard>
                ))}
              </div>
            ))}
          </div>
        ))}
      </Page>
    </>
  );
}
