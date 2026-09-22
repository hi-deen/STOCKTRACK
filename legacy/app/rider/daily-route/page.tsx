"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPin, RefreshCcw, Route, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRiderAuth } from "@/lib/rider/RiderAuthContext";
import RiderDeliveryModal from "@/components/phase9b/rider-delivery-modal";

type RiderRouteShop = {
  business_id: string;
  business_name: string;
  shop_id: string;
  shop_name: string;
  area: string | null;
  address: string | null;
  phone: string | null;
  photo_path: string | null;
  usual_order_summary: string | null;
  restocked_today: boolean;
  today_delivery_summary: string | null;
};

export default function RiderDailyRoutePage() {
  const router = useRouter();
  const { rider, loading: authLoading, logout } = useRiderAuth();
  const [shops, setShops] = useState<RiderRouteShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<RiderRouteShop | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!authLoading && !rider) {
      router.replace("/rider/login");
    }
  }, [authLoading, rider, router]);

  const loadRoute = async () => {
    const token = window.localStorage.getItem("rider_session_token");
    if (!supabase || !token) {
      router.replace("/rider/login");
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: routeError } = await supabase.rpc("get_rider_route", { token_input: token });
    if (routeError) {
      setError(routeError.message);
      setLoading(false);
      return;
    }

    setShops((data ?? []) as RiderRouteShop[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!supabase || !rider) {
      return;
    }

    void loadRoute();
  }, [router, rider, supabase]);

  const groupedShops = useMemo(() => {
    const grouped = new Map<string, RiderRouteShop[]>();
    shops.forEach((shop) => {
      const key = shop.business_name;
      const current = grouped.get(key) ?? [];
      current.push(shop);
      grouped.set(key, current);
    });
    return Array.from(grouped.entries());
  }, [shops]);

  const handleOpenModal = (shop: RiderRouteShop) => {
    setSelectedShop(shop);
    setModalOpen(true);
  };

  const handleSaved = async () => {
    await loadRoute();
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4">
        <p className="text-sm text-[color:var(--muted)]">Loading today&apos;s route…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] px-4 py-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Route</p>
            <h1 className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">Today&apos;s Deliveries</h1>
          </div>
          <button type="button" onClick={() => { void logout(); router.push("/rider/login"); }} className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[color:var(--ink)]">
            Logout
          </button>
        </div>

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[color:var(--ink)]">Route summary</p>
              <p className="text-sm text-[color:var(--muted)]">{shops.length} stop{shops.length === 1 ? "" : "s"} for today</p>
            </div>
            <button type="button" onClick={() => void loadRoute()} className="rounded-xl border border-[color:var(--border)] bg-white p-2 text-[color:var(--muted)]">
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {shops.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 text-center text-sm text-[color:var(--muted)]">
            No deliveries are assigned to you today.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedShops.map(([businessName, businessShops]) => (
              <section key={businessName} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                <h2 className="text-base font-semibold text-[color:var(--ink)]">{businessName}</h2>
                <div className="mt-3 space-y-3">
                  {businessShops.map((shop) => (
                    <button key={shop.shop_id} type="button" onClick={() => handleOpenModal(shop)} className="w-full rounded-2xl border border-[color:var(--border)] bg-white p-3 text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-[color:var(--primary)]" />
                            <p className="font-semibold text-[color:var(--ink)]">{shop.shop_name}</p>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm text-[color:var(--muted)]">
                            <MapPin className="h-4 w-4" />
                            <span>{shop.area || shop.address || "No location details"}</span>
                          </div>
                        </div>
                        <div className="rounded-full bg-[color:var(--cream)] px-2.5 py-1 text-xs font-semibold text-[color:var(--ink)]">
                          {shop.restocked_today ? "Done" : "Pending"}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted)]">
                        {shop.usual_order_summary ? <span className="rounded-full bg-[color:var(--cream)] px-2.5 py-1">{shop.usual_order_summary}</span> : null}
                        {shop.today_delivery_summary ? <span className="rounded-full border border-[color:var(--border)] px-2.5 py-1">{shop.today_delivery_summary}</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/rider/home" className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--ink)]">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <button type="button" onClick={() => void loadRoute()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[color:var(--ink)] px-4 py-3 text-sm font-semibold text-white">
            <Route className="h-4 w-4" />
            Refresh route
          </button>
        </div>
      </div>

      {selectedShop ? (
        <RiderDeliveryModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedShop(null);
          }}
          onSaved={() => void handleSaved()}
          businessId={selectedShop.business_id}
          shop={{
            id: selectedShop.shop_id,
            name: selectedShop.shop_name,
            area: selectedShop.area,
            address: selectedShop.address,
            phone: selectedShop.phone,
            photo_path: selectedShop.photo_path,
          }}
        />
      ) : null}
    </div>
  );
}
