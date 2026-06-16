"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ClipboardList, Search, Store, Truck, Wallet, Camera, CircleDollarSign, PackageCheck, Filter, ArrowRight, Plus, BadgeCheck, AlertTriangle, CloudOff, Clock3, RefreshCw } from "lucide-react";
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
import { cacheOperationsSnapshot, offlineDb, type OperationsCacheEntry, type PendingMutation } from "@/lib/offline/db";
import { triggerOfflineSync } from "@/lib/offline/sync";
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

function buildShopFromCachedRow(row: OperationsCacheEntry, businessId: string): Shop {
  return {
    id: row.shop_id,
    business_id: businessId,
    name: row.shop_name,
    owner_name: null,
    phone: row.phone ?? null,
    area: row.area ?? null,
    address: row.address ?? null,
    notes: null,
    photo_path: row.photo_path ?? null,
    is_active: true,
    created_at: new Date().toISOString(),
    created_by: null,
  };
}

function applyPendingMutationsToRows(rows: ShopOperationsRow[], pendingMutations: PendingMutation[]) {
  const today = new Date().toISOString().slice(0, 10);
  const optimisticRows = rows.map((row) => ({ ...row }));

  for (const mutation of pendingMutations) {
    if (mutation.status === "failed") {
      continue;
    }

    const payload = mutation.payload as Record<string, unknown>;
    const shopId = typeof payload.shop_id === "string" ? payload.shop_id : null;
    const row = optimisticRows.find((entry) => entry.shop_id === shopId);
    if (!row) {
      continue;
    }

    if (mutation.type === "delivery") {
      const totalAmount = Number(payload.total_amount ?? 0);
      const quantity = Number(payload.quantity ?? 0);
      const productName = typeof payload.product_name === "string" ? payload.product_name : "item";
      const unit = typeof payload.unit === "string" ? payload.unit : "";
      const summaryItem = [quantity > 0 ? `${quantity}${unit ? ` ${unit}` : ""}` : null, productName].filter(Boolean).join(" ");
      row.balance = Number(row.balance) + totalAmount;
      row.restocked_today = true;
      row.days_since_restock = 0;
      row.last_restock_date = today;
      row.today_delivery_summary = [row.today_delivery_summary, summaryItem].filter(Boolean).join(" • ");
    }

    if (mutation.type === "payment") {
      const amount = Number(payload.amount ?? 0);
      row.balance = Math.max(0, Number(row.balance) - amount);
      row.payments_today_total = Number(row.payments_today_total ?? 0) + amount;
      row.payment_status_today = row.balance <= 0 ? "full" : "partial";
      row.last_payment_method_today = typeof payload.method === "string" ? payload.method : row.last_payment_method_today;
    }
  }

  return optimisticRows;
}

async function persistOptimisticCacheUpdate({
  businessId,
  mutation,
  currentRows,
}: {
  businessId: string;
  mutation: PendingMutation;
  currentRows: ShopOperationsRow[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const shopId = typeof mutation.payload.shop_id === "string" ? mutation.payload.shop_id : null;
  if (!shopId) {
    return;
  }

  const currentRow = currentRows.find((entry) => entry.shop_id === shopId);
  if (!currentRow) {
    return;
  }

  let nextRow = { ...currentRow };
  if (mutation.type === "delivery") {
    const totalAmount = Number(mutation.payload.total_amount ?? 0);
    const quantity = Number(mutation.payload.quantity ?? 0);
    const productName = typeof mutation.payload.product_name === "string" ? mutation.payload.product_name : "item";
    const unit = typeof mutation.payload.unit === "string" ? mutation.payload.unit : "";
    const summaryItem = [quantity > 0 ? `${quantity}${unit ? ` ${unit}` : ""}` : null, productName].filter(Boolean).join(" ");
    nextRow.balance = Number(nextRow.balance) + totalAmount;
    nextRow.restocked_today = true;
    nextRow.days_since_restock = 0;
    nextRow.last_restock_date = today;
    nextRow.today_delivery_summary = [nextRow.today_delivery_summary, summaryItem].filter(Boolean).join(" • ");
  }

  if (mutation.type === "payment") {
    const amount = Number(mutation.payload.amount ?? 0);
    nextRow.balance = Math.max(0, Number(nextRow.balance) - amount);
    nextRow.payments_today_total = Number(nextRow.payments_today_total ?? 0) + amount;
    nextRow.payment_status_today = nextRow.balance <= 0 ? "full" : "partial";
    nextRow.last_payment_method_today = typeof mutation.payload.method === "string" ? mutation.payload.method : nextRow.last_payment_method_today;
  }

  const cachedAt = new Date().toISOString();
  await offlineDb.operationsCache.put({
    ...nextRow,
    business_id: businessId,
    cached_at: cachedAt,
  });
}

function isNetworkError(error: unknown) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /network|failed to fetch|fetch failed|offline|socket|timeout/i.test(message);
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
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [offlineToast, setOfflineToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pendingMutations, setPendingMutations] = useState<PendingMutation[]>([]);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [failedMutations, setFailedMutations] = useState<PendingMutation[]>([]);

  const loadPendingState = async (businessId: string) => {
    const pendingItems = await offlineDb.pendingMutations.where("business_id").equals(businessId).toArray();
    setPendingMutations(pendingItems);
    setPendingSyncCount(pendingItems.filter((item) => item.status === "pending" || item.status === "syncing").length);
    setFailedMutations(pendingItems.filter((item) => item.status === "failed"));
  };

  const loadOperations = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setRows([]);
      setShops([]);
      setProducts([]);
      setOfflineNotice(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    await loadPendingState(activeBusinessId);
    const [operationsRes, shopsRes, productsRes] = await Promise.all([
      supabase.rpc("get_operations_view", { business_id_input: activeBusinessId }),
      supabase.from("shops").select("*").eq("business_id", activeBusinessId).order("name"),
      supabase.from("products").select("*").eq("business_id", activeBusinessId).order("name"),
    ]);

    const useOfflineFallback = typeof window === "undefined" ? false : !navigator.onLine || Boolean(operationsRes.error || shopsRes.error || productsRes.error);

    if (useOfflineFallback) {
      const [cachedRows, cachedProducts, pendingMutations, syncMeta] = await Promise.all([
        offlineDb.operationsCache.where("business_id").equals(activeBusinessId).toArray(),
        offlineDb.productsCache.where("business_id").equals(activeBusinessId).toArray(),
        offlineDb.pendingMutations.where("business_id").equals(activeBusinessId).filter((mutation) => mutation.status === "pending" || mutation.status === "syncing").toArray(),
        offlineDb.syncMeta.get(activeBusinessId),
      ]);

      const optimisticRows = applyPendingMutationsToRows(cachedRows as OperationsCacheEntry[], pendingMutations);
      const derivedShops = optimisticRows.map((row) => buildShopFromCachedRow(row as OperationsCacheEntry, activeBusinessId));
      const cachedAt = syncMeta?.last_synced_at ?? null;

      setRows(optimisticRows);
      setShops(derivedShops);
      setProducts((cachedProducts ?? []) as Product[]);
      setOfflineNotice(cachedAt ? `Offline - showing data cached at ${cachedAt}` : "Offline - showing cached data");
      setError(null);
      setLoading(false);
      return;
    }

    const nextRows = (operationsRes.data ?? []) as ShopOperationsRow[];
    const nextProducts = (productsRes.data ?? []) as Product[];

    setRows(nextRows);
    setShops((shopsRes.data ?? []) as Shop[]);
    setProducts(nextProducts);
    setOfflineNotice(null);

    if (typeof window !== "undefined" && navigator.onLine && !productsRes.error) {
      void cacheOperationsSnapshot({ businessId: activeBusinessId, rows: nextRows, products: nextProducts });
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadOperations();
  }, [activeBusinessId]);

  useEffect(() => {
    if (!activeBusinessId || !window?.navigator?.onLine) {
      return;
    }

    const runAutoSync = async () => {
      const pendingCount = await offlineDb.pendingMutations.where("business_id").equals(activeBusinessId).filter((mutation) => mutation.status === "pending" || mutation.status === "syncing").count();
      if (pendingCount > 0) {
        setSyncing(true);
        try {
          await triggerOfflineSync(activeBusinessId);
          await loadOperations();
        } finally {
          setSyncing(false);
        }
      }
    };

    const onOnline = () => {
      void runAutoSync();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runAutoSync();
      }
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    void runAutoSync();

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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

  const handleSyncNow = async () => {
    if (!activeBusinessId) {
      return;
    }

    setSyncing(true);
    try {
      await triggerOfflineSync(activeBusinessId);
      await loadOperations();
    } finally {
      setSyncing(false);
    }
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
    setOfflineToast(null);

    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const totalAmount = payload.quantity * payload.unit_price;
    const deliveryPayload = {
      business_id: activeBusinessId,
      shop_id: payload.shop_id,
      product_id: payload.product_id,
      quantity: payload.quantity,
      unit_price: payload.unit_price,
      total_amount: totalAmount,
      delivery_date: payload.delivery_date,
      notes: payload.notes || null,
      created_by: userId,
      product_name: products.find((item) => item.id === payload.product_id)?.name ?? "item",
      unit: products.find((item) => item.id === payload.product_id)?.unit ?? "",
    };

    const shouldQueueOffline = typeof window !== "undefined" && !navigator.onLine;

    try {
      if (shouldQueueOffline) {
        throw new Error("offline");
      }

      const { error } = await supabase.from("stock_deliveries").insert({
        business_id: activeBusinessId,
        shop_id: payload.shop_id,
        product_id: payload.product_id,
        quantity: payload.quantity,
        unit_price: payload.unit_price,
        total_amount: totalAmount,
        delivery_date: payload.delivery_date,
        notes: payload.notes || null,
        created_by: userId,
      });

      if (error) {
        if (isNetworkError(error) || !navigator.onLine) {
          throw error;
        }
        setError(error.message);
        setSubmitting(false);
        return;
      }

      setSuccess("Restock recorded.");
      setSubmitting(false);
      setDeliveryModalOpen(false);
      await loadOperations();
      return;
    } catch (error) {
      const mutation: PendingMutation = {
        business_id: activeBusinessId,
        type: "delivery",
        payload: deliveryPayload,
        created_at: new Date().toISOString(),
        status: "pending",
        error_message: null,
      };
      await offlineDb.pendingMutations.add(mutation);
      const nextRows = applyPendingMutationsToRows(rows, [mutation]);
      setRows(nextRows);
      await persistOptimisticCacheUpdate({ businessId: activeBusinessId, mutation, currentRows: rows });
      setOfflineToast("Saved offline - will sync when connected");
      setSubmitting(false);
      setDeliveryModalOpen(false);
      await loadOperations();
    }
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
    setOfflineToast(null);

    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    const paymentPayload = {
      business_id: activeBusinessId,
      shop_id: payload.shop_id,
      amount: payload.amount,
      payment_date: payload.payment_date,
      method: payload.method,
      notes: payload.notes || null,
      created_by: userId,
    };

    const shouldQueueOffline = typeof window !== "undefined" && !navigator.onLine;

    try {
      if (shouldQueueOffline) {
        throw new Error("offline");
      }

      const { error } = await supabase.from("payments").insert({
        business_id: activeBusinessId,
        shop_id: payload.shop_id,
        amount: payload.amount,
        payment_date: payload.payment_date,
        method: payload.method,
        notes: payload.notes || null,
        created_by: userId,
      });

      if (error) {
        if (isNetworkError(error) || !navigator.onLine) {
          throw error;
        }
        setError(error.message);
        setSubmitting(false);
        return;
      }

      setSuccess("Payment recorded.");
      setSubmitting(false);
      setPaymentModalOpen(false);
      await loadOperations();
      return;
    } catch (error) {
      const mutation: PendingMutation = {
        business_id: activeBusinessId,
        type: "payment",
        payload: paymentPayload,
        created_at: new Date().toISOString(),
        status: "pending",
        error_message: null,
      };
      await offlineDb.pendingMutations.add(mutation);
      const nextRows = applyPendingMutationsToRows(rows, [mutation]);
      setRows(nextRows);
      await persistOptimisticCacheUpdate({ businessId: activeBusinessId, mutation, currentRows: rows });

      const currentRow = rows.find((entry) => entry.shop_id === payload.shop_id);
      const nextBalance = Math.max(0, Number(currentRow?.balance ?? 0) - payload.amount);
      if (nextBalance > 0) {
        const reminderMutation: PendingMutation = {
          business_id: activeBusinessId,
          type: "reminder",
          payload: {
            business_id: activeBusinessId,
            shop_id: payload.shop_id,
            type: "payment",
            title: "Follow up payment",
            message: "A partial payment was recorded while offline. Please confirm the remaining balance when connected.",
            due_date: new Date().toISOString().slice(0, 10),
            created_by: userId,
          },
          created_at: new Date().toISOString(),
          status: "pending",
          error_message: null,
        };
        await offlineDb.pendingMutations.add(reminderMutation);
      }

      setOfflineToast("Saved offline - will sync when connected");
      setSubmitting(false);
      setPaymentModalOpen(false);
      await loadOperations();
    }
  };

  const handleRetryMutation = async (mutationId: number) => {
    await offlineDb.pendingMutations.update(mutationId, { status: "pending", error_message: null });
    await loadPendingState(activeBusinessId!);
    await handleSyncNow();
  };

  const handleDiscardMutation = async (mutationId: number) => {
    const confirmed = window.confirm("Discard this queued change? The local data will be lost.");
    if (!confirmed) {
      return;
    }
    await offlineDb.pendingMutations.delete(mutationId);
    await loadPendingState(activeBusinessId!);
    await loadOperations();
  };

  const handleCreateShop = async (payload: { name: string; owner_name: string; phone: string; area: string; address: string; notes: string; photoFile?: File | null; removePhoto?: boolean }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    let photoPath = null;
    if (payload.photoFile) {
      try {
        const compressed = await browserImageCompression(payload.photoFile, { maxWidthOrHeight: 800, maxSizeMB: 0.2, useWebWorker: true });
        const shopId = `shop_${Date.now()}`;
        const fileName = `${Date.now()}.jpg`;
        const objectPath = `${activeBusinessId}/${shopId}/${fileName}`;
        const uploadResult = await supabase.storage.from("shop-photos").upload(objectPath, compressed, { contentType: compressed.type || "image/jpeg" });
        if (uploadResult.error) {
          setWarning(`The photo could not be uploaded: ${uploadResult.error.message}`);
        } else {
          photoPath = objectPath;
        }
      } catch {
        setWarning("The photo could not be compressed before upload.");
      }
    }

    const shopPayload = {
      business_id: activeBusinessId,
      name: payload.name,
      owner_name: payload.owner_name || null,
      phone: payload.phone || null,
      area: payload.area || null,
      address: payload.address || null,
      notes: payload.notes || null,
      photo_path: photoPath,
      is_active: true,
    };

    const { error } = await supabase.from("shops").insert([shopPayload]);
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setSuccess("Shop created.");
    setSubmitting(false);
    setShopModalOpen(false);
    setEditingShop(null);
    await loadOperations();
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

    const shopPayload = {
      name: payload.name,
      owner_name: payload.owner_name,
      phone: payload.phone,
      area: payload.area,
      address: payload.address,
      notes: payload.notes,
    };

    const { error } = await supabase.from("shops").update({ ...shopPayload, photo_path: nextPhotoPath }).eq("id", editingShop.id).eq("business_id", activeBusinessId);
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
            <Button variant="outline" href="/dashboard/product-delivery">Open Product Delivery</Button>
            <Button variant="outline" onClick={handleSyncNow} disabled={syncing}>
              {syncing ? "Syncing..." : "Sync now"}
            </Button>
          </div>
        </div>
      </Card>

      {error ? <div className="rounded-[1.35rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/70 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}
      {success ? <div className="rounded-[1.35rem] border border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/70 p-3 text-sm text-[color:var(--success)]">{success}</div> : null}
      {warning ? <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{warning}</div> : null}
      {offlineToast ? (
        <div className="flex items-center gap-2 rounded-[1.35rem] border border-[color:var(--border)] bg-[color:var(--cream)]/90 px-3 py-2 text-sm text-[color:var(--ink)]">
          <CloudOff className="h-4 w-4 text-[color:var(--primary)]" />
          {offlineToast}
        </div>
      ) : null}
      {offlineNotice ? (
        <div className="flex items-center gap-2 rounded-[1.35rem] border border-[color:var(--border)] bg-[color:var(--cream)]/80 px-3 py-2 text-sm text-[color:var(--ink)]">
          <CloudOff className="h-4 w-4 text-[color:var(--primary)]" />
          {offlineNotice}
        </div>
      ) : null}
      {pendingSyncCount > 0 ? (
        <div className="flex flex-col gap-2 rounded-[1.35rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
          <button type="button" onClick={() => setShowPendingPanel((value) => !value)} className="flex items-center justify-between text-sm font-semibold text-[color:var(--ink)]">
            <span>{pendingSyncCount} pending sync</span>
            <Clock3 className="h-4 w-4 text-[color:var(--primary)]" />
          </button>
          {showPendingPanel ? (
            <div className="space-y-2">
              {pendingMutations.length > 0 ? pendingMutations.map((mutation) => {
                const shopName = shops.find((shop) => shop.id === mutation.payload.shop_id)?.name ?? "Unknown shop";
                return (
                  <div key={mutation.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--cream)]/60 p-3 text-sm text-[color:var(--muted)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[color:var(--ink)]">{shopName}</p>
                        <p className="mt-1">{mutation.type} • {new Date(mutation.created_at).toLocaleString()}</p>
                      </div>
                      <span className="rounded-full bg-[color:var(--surface)] px-2 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--ink)]">{mutation.status}</span>
                    </div>
                  </div>
                );
              }) : <p className="text-sm text-[color:var(--muted)]">No pending actions right now.</p>}
            </div>
          ) : null}
        </div>
      ) : null}
      {failedMutations.length > 0 ? (
        <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <p className="font-semibold">Sync issues ({failedMutations.length})</p>
          <div className="mt-2 space-y-2">
            {failedMutations.map((mutation) => {
              const shopName = shops.find((shop) => shop.id === mutation.payload.shop_id)?.name ?? "Unknown shop";
              return (
                <div key={mutation.id} className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{shopName}</p>
                    <p className="text-xs">{mutation.type} • {mutation.error_message}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void handleRetryMutation(mutation.id!)} className="rounded-xl border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800">Retry</button>
                    <button type="button" onClick={() => void handleDiscardMutation(mutation.id!)} className="rounded-xl border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800">Discard</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

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
                                {pendingMutations.some((item) => item.payload.shop_id === row.shop_id && (item.status === "pending" || item.status === "syncing")) ? <Clock3 className="h-3.5 w-3.5 text-[color:var(--primary)]" /> : null}
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
      <ShopFormModal open={shopModalOpen} mode={editingShop ? "edit" : "create"} shop={editingShop} onClose={() => { setShopModalOpen(false); setEditingShop(null); setError(null); setSuccess(null); setWarning(null); }} onSubmit={editingShop ? handleUpdateShop : handleCreateShop} submitting={submitting} error={error} success={success} warning={warning} />
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
