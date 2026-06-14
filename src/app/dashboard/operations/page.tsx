"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ClipboardList, Search, Store, Truck, Wallet, Camera, CircleDollarSign, PackageCheck, Filter, ArrowRight, Plus, BadgeCheck, AlertTriangle } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import ShopProfileModal from "@/components/modals/ShopProfileModal";
import DeliveryModal from "@/components/phase3/delivery-modal";
import PaymentModal from "@/components/phase3/payment-modal";
import ShopFormModal from "@/components/phase2/shop-form-modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { useSignedPhotoUrl } from "@/lib/supabase/photo";
import type { Payment, Product, Shop, ShopOperationsRow, StockDelivery } from "@/types/phase2";
import browserImageCompression from "browser-image-compression";

function formatCurrency(value: number) {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

function formatDays(value: number | null) {
  if (value == null) {
    return "Never restocked";
  }
  if (value === 0) {
    return "Today";
  }
  return `${value}d ago`;
}

export default function OperationsPage() {
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [rows, setRows] = useState<ShopOperationsRow[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedAreas, setExpandedAreas] = useState<Record<string, boolean>>({});
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [shopModalOpen, setShopModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const loadOperations = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [operationsRes, shopsRes, productsRes] = await Promise.all([
      supabase.rpc("get_operations_view", { business_id_input: activeBusinessId }),
      supabase.from("shops").select("*").eq("business_id", activeBusinessId).order("name"),
      supabase.from("products").select("*").eq("business_id", activeBusinessId).order("name"),
    ]);

    if (operationsRes.error) {
      setError(operationsRes.error.message);
      setLoading(false);
      return;
    }

    setRows((operationsRes.data ?? []) as ShopOperationsRow[]);
    setShops((shopsRes.data ?? []) as Shop[]);
    setProducts((productsRes.data ?? []) as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadOperations();
  }, [activeBusinessId]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      return;
    }

    const channel = supabase.channel("operations-activity");
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "stock_deliveries", filter: `business_id=eq.${activeBusinessId}` }, () => { void loadOperations(); });
    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "payments", filter: `business_id=eq.${activeBusinessId}` }, () => { void loadOperations(); });
    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeBusinessId]);

  const groupedRows = useMemo(() => {
    const normalizedQuery = search.toLowerCase().trim();
    const filtered = rows.filter((row) => {
      if (!normalizedQuery) {
        return true;
      }
      return [row.shop_name, row.area ?? "", row.address ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
    });

    return filtered.reduce<Record<string, ShopOperationsRow[]>>((groups, row) => {
      const area = row.area?.trim() || "Unassigned";
      if (!groups[area]) {
        groups[area] = [];
      }
      groups[area].push(row);
      return groups;
    }, {});
  }, [rows, search]);

  useEffect(() => {
    if (!Object.keys(expandedAreas).length && Object.keys(groupedRows).length) {
      const initial = Object.keys(groupedRows).reduce<Record<string, boolean>>((acc, area) => {
        acc[area] = true;
        return acc;
      }, {});
      setExpandedAreas(initial);
    }
  }, [groupedRows, expandedAreas]);

  const summary = useMemo(() => {
    const visitedCount = rows.filter((row) => row.restocked_today || row.payments_today_total > 0).length;
    const totalDelivered = rows.reduce((sum, row) => sum + Number(row.balance > 0 ? 0 : 0), 0);
    const totalCollected = rows.reduce((sum, row) => sum + Number(row.payments_today_total ?? 0), 0);
    return {
      visitedCount,
      totalCount: rows.length,
      totalCollectedToday: totalCollected,
      totalDeliveredToday: totalDelivered,
    };
  }, [rows]);

  const openShopProfile = (shopId: string) => {
    const shop = shops.find((item) => item.id === shopId) ?? null;
    setSelectedShop(shop);
    setProfileOpen(true);
  };

  const openShopModal = (shop: Shop | null) => {
    setEditingShop(shop);
    setShopModalOpen(true);
  };

  const openRestock = (shopId: string) => {
    setActiveShopId(shopId);
    setDeliveryModalOpen(true);
  };

  const openPayment = (shopId: string) => {
    setActiveShopId(shopId);
    setPaymentModalOpen(true);
  };

  const handleCreateDelivery = async (payload: { shop_id: string; product_id: string; quantity: number; unit_price: number; delivery_date: string; notes: string }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error } = await supabase.from("stock_deliveries").insert({ business_id: activeBusinessId, shop_id: payload.shop_id, product_id: payload.product_id, quantity: payload.quantity, unit_price: payload.unit_price, total_amount: payload.quantity * payload.unit_price, delivery_date: payload.delivery_date, notes: payload.notes || null, created_by: (await supabase.auth.getUser()).data.user?.id ?? null });
    if (error) {
      setError(error.message); setSubmitting(false); return;
    }
    setSuccess("Restock recorded."); setSubmitting(false); setDeliveryModalOpen(false); await loadOperations();
  };

  const handleCreatePayment = async (payload: { shop_id: string; amount: number; payment_date: string; method: string; notes: string }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    const { error } = await supabase.from("payments").insert({ business_id: activeBusinessId, shop_id: payload.shop_id, amount: payload.amount, payment_date: payload.payment_date, method: payload.method, notes: payload.notes || null, created_by: (await supabase.auth.getUser()).data.user?.id ?? null });
    if (error) {
      setError(error.message); setSubmitting(false); return;
    }
    setSuccess("Payment recorded."); setSubmitting(false); setPaymentModalOpen(false); await loadOperations();
  };

  const handleUpdateShop = async (payload: { name: string; owner_name: string; phone: string; area: string; address: string; notes: string; photoFile?: File | null; removePhoto?: boolean }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId || !editingShop) {
      setError("Select a business first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    let nextPhotoPath = editingShop.photo_path ?? null;
    if (payload.removePhoto && editingShop.photo_path) {
      const { error: deleteError } = await supabase.storage.from("shop-photos").remove([editingShop.photo_path]);
      if (deleteError) {
        setWarning("The photo could not be removed from storage, but the shop update will continue.");
      } else {
        nextPhotoPath = null;
      }
    }

    if (payload.photoFile) {
      try {
        const compressed = await browserImageCompression(payload.photoFile, { maxWidthOrHeight: 800, maxSizeMB: 0.2, useWebWorker: true });
        const fileName = `${Date.now()}.jpg`;
        const objectPath = `${activeBusinessId}/${editingShop.id}/${fileName}`;
        const uploadResult = await supabase.storage.from("shop-photos").upload(objectPath, compressed, { contentType: compressed.type || "image/jpeg", upsert: true });
        if (uploadResult.error) {
          setWarning(`The photo could not be uploaded: ${uploadResult.error.message}`);
        } else {
          if (editingShop.photo_path && editingShop.photo_path !== objectPath) {
            await supabase.storage.from("shop-photos").remove([editingShop.photo_path]);
          }
          nextPhotoPath = objectPath;
        }
      } catch {
        setWarning("The photo could not be compressed before upload.");
      }
    }

    const { error } = await supabase.from("shops").update({ ...payload, photo_path: nextPhotoPath }).eq("id", editingShop.id).eq("business_id", activeBusinessId);
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setSuccess("Shop updated.");
    setSubmitting(false);
    setShopModalOpen(false);
    setEditingShop(null);
    await loadOperations();
  };

  if (businessLoading || loading) {
    return <div className="space-y-6"><Card><Skeleton className="h-4 w-32" /><Skeleton className="mt-3 h-8 w-64" /><Skeleton className="mt-3 h-4 w-80" /></Card><Skeleton className="h-28" /><Skeleton className="h-96" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-[color:var(--border)] bg-[color:var(--surface)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Operations</p>
            <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">Daily field work at a glance</h1>
            <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted)]">Restock, collect payments, and keep each shop moving with the most urgent visits first.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setEditingShop(null); setShopModalOpen(true); }} icon={Plus}>Add Shop</Button>
            <Button variant="outline" href="/dashboard/stock">Open Stock Ledger</Button>
          </div>
        </div>
      </Card>

      {error ? <div className="rounded-[1.35rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/70 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}
      {success ? <div className="rounded-[1.35rem] border border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/70 p-3 text-sm text-[color:var(--success)]">{success}</div> : null}
      {warning ? <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{warning}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-[color:var(--border)] bg-[color:var(--surface)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]"><ClipboardList className="h-4 w-4 text-[color:var(--primary)]" /> Visits today</div>
          <div className="mt-3 text-3xl font-semibold text-[color:var(--ink)]">{summary.visitedCount} / {summary.totalCount}</div>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Shops with a restock or payment entry today.</p>
        </Card>
        <Card className="border border-[color:var(--border)] bg-[color:var(--surface)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]"><CircleDollarSign className="h-4 w-4 text-[color:var(--primary)]" /> Collected today</div>
          <div className="mt-3 text-3xl font-semibold text-[color:var(--ink)]">{formatCurrency(summary.totalCollectedToday)}</div>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Payments captured for today’s visits.</p>
        </Card>
        <Card className="border border-[color:var(--border)] bg-[color:var(--surface)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]"><Truck className="h-4 w-4 text-[color:var(--primary)]" /> Delivered today</div>
          <div className="mt-3 text-3xl font-semibold text-[color:var(--ink)]">{formatCurrency(summary.totalDeliveredToday)}</div>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Total stock value logged today.</p>
        </Card>
      </div>

      <Card padded={false} className="p-3">
        <div className="flex items-center gap-2 rounded-[1rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
          <Search className="h-4 w-4 text-[color:var(--muted)]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shop or area" className="w-full border-0 bg-transparent p-0 text-sm focus:ring-0" />
        </div>
      </Card>

      {Object.keys(groupedRows).length === 0 ? (
        <EmptyState icon={Store} title="No shops to visit" description="Add your first shop or adjust the search to see today's operations queue." actionLabel="Add shop" onAction={() => setShopModalOpen(true)} />
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedRows).map(([area, areaRows]) => {
            const isExpanded = expandedAreas[area] ?? true;
            return (
              <Card key={area} padded={false} className="overflow-hidden">
                <button type="button" className="flex w-full items-center justify-between bg-[color:var(--cream)]/60 px-4 py-3 text-left" onClick={() => setExpandedAreas((previous) => ({ ...previous, [area]: !isExpanded }))}>
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--ink)]">{area}</p>
                    <p className="text-xs text-[color:var(--muted)]">{areaRows.length} shops • {areaRows.filter((row) => row.restocked_today || row.payments_today_total > 0).length} visited today</p>
                  </div>
                  {isExpanded ? <ChevronDown className="h-5 w-5 text-[color:var(--muted)]" /> : <ChevronRight className="h-5 w-5 text-[color:var(--muted)]" />}
                </button>
                {isExpanded ? (
                  <div className="divide-y divide-[color:var(--border)]">
                    {areaRows.map((row) => {
                      const isUrgent = row.days_since_restock == null || (row.days_since_restock ?? 0) > 0;
                      const badgeVariant = row.balance > 0 ? "danger" : row.payment_status_today === "full" ? "success" : "neutral";
                      return (
                        <div key={row.shop_id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                          <button type="button" className="flex flex-1 items-start gap-3 text-left" onClick={() => openShopProfile(row.shop_id)}>
                            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[color:var(--cream)]">
                              <ShopPhotoAvatar shopId={row.shop_id} photoPath={row.photo_path} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-semibold text-[color:var(--ink)]">{row.shop_name}</p>
                                <Badge variant={isUrgent ? "warning" : "neutral"}>{formatDays(row.days_since_restock)}</Badge>
                                <Badge variant={badgeVariant}>{row.balance > 0 ? formatCurrency(row.balance) : "Cleared"}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-[color:var(--muted)]">{row.address || "No address on file"}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {row.restocked_today ? <Badge variant="success" className="gap-1"><PackageCheck className="h-3.5 w-3.5" /> Restocked today</Badge> : null}
                                {row.payment_status_today === "partial" ? <Badge variant="warning">Partial payout</Badge> : null}
                                {row.payment_status_today === "full" ? <Badge variant="success">Paid today</Badge> : null}
                                {row.payment_status_today === "none" && row.balance > 0 ? <Badge variant="danger">Collect now</Badge> : null}
                              </div>
                            </div>
                          </button>
                          <div className="flex flex-col gap-2 md:items-end">
                            <div className="flex flex-wrap gap-2">
                              <Button variant={row.restocked_today ? "secondary" : "outline"} icon={Truck} onClick={() => openRestock(row.shop_id)}>{row.restocked_today ? "Restocked ✓" : "Restock"}</Button>
                              <Button variant={row.payment_status_today === "full" ? "secondary" : row.balance > 0 && row.payment_status_today === "none" ? "danger" : row.payment_status_today === "partial" ? "outline" : "outline"} icon={Wallet} onClick={() => openPayment(row.shop_id)}>{renderPaymentLabel(row)}</Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <ShopProfileModal open={profileOpen} shop={selectedShop} balance={selectedShop ? rows.find((row) => row.shop_id === selectedShop.id)?.balance ?? 0 : 0} lastRestockedLabel={selectedShop ? (rows.find((row) => row.shop_id === selectedShop.id)?.days_since_restock == null ? "Never restocked" : `Last restock: ${formatDays(rows.find((row) => row.shop_id === selectedShop.id)?.days_since_restock ?? null)}`) : "—"} lastPaymentLabel={selectedShop ? `Last payment: ${rows.find((row) => row.shop_id === selectedShop.id)?.last_payment_method_today ?? "none"}` : "—"} onClose={() => setProfileOpen(false)} onEdit={() => { setEditingShop(selectedShop); setShopModalOpen(true); setProfileOpen(false); }} />

      <DeliveryModal open={deliveryModalOpen} onClose={() => { setDeliveryModalOpen(false); setError(null); setSuccess(null); }} onSubmit={handleCreateDelivery} submitting={submitting} error={error} success={success} shops={shops} products={products} defaultShopId={activeShopId} />
      <PaymentModal open={paymentModalOpen} onClose={() => { setPaymentModalOpen(false); setError(null); setSuccess(null); }} onSubmit={handleCreatePayment} submitting={submitting} error={error} success={success} shops={shops} defaultShopId={activeShopId} />
      <ShopFormModal open={shopModalOpen} mode={editingShop ? "edit" : "create"} shop={editingShop} onClose={() => { setShopModalOpen(false); setEditingShop(null); setError(null); setSuccess(null); setWarning(null); }} onSubmit={handleUpdateShop} submitting={submitting} error={error} success={success} warning={warning} />
    </div>
  );
}

function renderPaymentLabel(row: ShopOperationsRow) {
  if (row.payment_status_today === "full") {
    return "Paid ✓";
  }
  if (row.payment_status_today === "partial") {
    return `Partial ₦${row.payments_today_total}`;
  }
  if (row.balance > 0) {
    return `Collect ₦${row.balance}`;
  }
  return "Payment";
}

function ShopPhotoAvatar({ shopId, photoPath }: { shopId: string; photoPath: string | null }) {
  const signedPhotoUrl = useSignedPhotoUrl(photoPath);
  if (signedPhotoUrl) {
    return <img src={signedPhotoUrl} alt="shop" className="h-full w-full object-cover" />;
  }
  return <Store className="h-5 w-5 text-[color:var(--primary)]" />;
}
