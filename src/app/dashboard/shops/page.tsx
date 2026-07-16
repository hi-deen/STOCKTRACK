"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle, PencilLine, Plus, Search, Store, ToggleLeft, ToggleRight, Download, Upload } from "lucide-react";
import Papa from 'papaparse';
import browserImageCompression from "browser-image-compression";
import { useBusiness } from "@/components/providers/business-provider";
import ShopFormModal from "@/components/phase2/shop-form-modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Product, Shop } from "@/types/phase2";

export default function ShopsPage() {
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [shopProducts, setShopProducts] = useState<Array<{ shop_id: string; product_id: string; usual_quantity: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { activeBusinessRole } = useBusiness();

  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importCount, setImportCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [visitedTodayShopIds, setVisitedTodayShopIds] = useState<Set<string>>(new Set());

  const loadShops = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setShops([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [shopsRes, productsRes, shopProductsRes] = await Promise.all([
      supabase.from("shops").select("*").eq("business_id", activeBusinessId).order("created_at", { ascending: false }),
      supabase.from("products").select("*").eq("business_id", activeBusinessId).order("name"),
      supabase.from("shop_products").select("*")
    ]);

    if (shopsRes.error || productsRes.error || shopProductsRes.error) {
      setError((shopsRes.error ?? productsRes.error ?? shopProductsRes.error)?.message ?? "Unable to load shops.");
      setLoading(false);
      return;
    }

    setShops((shopsRes.data ?? []) as Shop[]);
    setProducts((productsRes.data ?? []) as Product[]);
    setShopProducts((shopProductsRes.data ?? []) as Array<{ shop_id: string; product_id: string; usual_quantity: number | null }>);
    setLoading(false);
  };

  const loadVisitedTodayShopIds = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setVisitedTodayShopIds(new Set());
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const [deliveriesRes, paymentsRes] = await Promise.all([
      supabase.from("stock_deliveries").select("shop_id").eq("business_id", activeBusinessId).eq("delivery_date", today).is('voided_at', null),
      supabase.from("payments").select("shop_id").eq("business_id", activeBusinessId).eq("payment_date", today).is('voided_at', null),
    ]);

    if (deliveriesRes.error || paymentsRes.error) {
      setVisitedTodayShopIds(new Set());
      return;
    }

    const nextVisitedShopIds = new Set<string>();
    (deliveriesRes.data ?? []).forEach((row) => nextVisitedShopIds.add(row.shop_id));
    (paymentsRes.data ?? []).forEach((row) => nextVisitedShopIds.add(row.shop_id));
    setVisitedTodayShopIds(nextVisitedShopIds);
  };

  useEffect(() => {
    void loadShops();
    void loadVisitedTodayShopIds();
  }, [activeBusinessId]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      return;
    }

    const channel = supabase.channel("shops-activity-updates");

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "stock_deliveries", filter: `business_id=eq.${activeBusinessId}` }, (payload) => {
      const shopId = payload.new?.shop_id;
      if (shopId) {
        setVisitedTodayShopIds((previous) => {
          const next = new Set(previous);
          next.add(shopId);
          return next;
        });
      }
    });

    channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "payments", filter: `business_id=eq.${activeBusinessId}` }, (payload) => {
      const shopId = payload.new?.shop_id;
      if (shopId) {
        setVisitedTodayShopIds((previous) => {
          const next = new Set(previous);
          next.add(shopId);
          return next;
        });
      }
    });

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeBusinessId]);

  const shopProductDefaults = useMemo(() => Object.fromEntries(
    shopProducts
      .filter((entry) => entry.shop_id === editingShop?.id)
      .map((entry) => [entry.product_id, entry.usual_quantity?.toString() ?? ""])
  ), [shopProducts, editingShop?.id]);

  const filteredShops = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return shops.filter((shop) => [shop.name, shop.area ?? "", shop.owner_name ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery)));
  }, [query, shops]);

  const handleCreateOrUpdate = async (payload: { name: string; owner_name: string; phone: string; area: string; address: string; notes: string; photoFile?: File | null; removePhoto?: boolean; usualQuantities: Record<string, string> }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    const shopPayload = {
      name: payload.name,
      owner_name: payload.owner_name,
      phone: payload.phone,
      area: payload.area,
      address: payload.address,
      notes: payload.notes,
    };

    if (editingShop) {
      const { error } = await supabase.from("shops").update(shopPayload).eq("id", editingShop.id).eq("business_id", activeBusinessId);

      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }

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

      if (nextPhotoPath !== editingShop.photo_path) {
        const { error: updatePhotoError } = await supabase.from("shops").update({ photo_path: nextPhotoPath }).eq("id", editingShop.id).eq("business_id", activeBusinessId);
        if (updatePhotoError) {
          setWarning("The shop was updated, but the photo path could not be saved.");
        }
      }

      await saveUsualQuantities(editingShop.id, payload.usualQuantities);
    } else {
      const { data: insertedShop, error: insertError } = await supabase.from("shops").insert({ business_id: activeBusinessId, ...shopPayload }).select().single();

      if (insertError || !insertedShop) {
        setError(insertError?.message ?? "Could not create shop.");
        setSubmitting(false);
        return;
      }

      await saveUsualQuantities(insertedShop.id, payload.usualQuantities);

      if (payload.photoFile) {
        try {
          const compressed = await browserImageCompression(payload.photoFile, { maxWidthOrHeight: 800, maxSizeMB: 0.2, useWebWorker: true });
          const fileName = `${Date.now()}.jpg`;
          const objectPath = `${activeBusinessId}/${insertedShop.id}/${fileName}`;
          const uploadResult = await supabase.storage.from("shop-photos").upload(objectPath, compressed, { contentType: compressed.type || "image/jpeg", upsert: true });
          if (uploadResult.error) {
            setWarning(`The photo could not be uploaded: ${uploadResult.error.message}`);
          } else {
            const { error: updatePhotoError } = await supabase.from("shops").update({ photo_path: objectPath }).eq("id", insertedShop.id).eq("business_id", activeBusinessId);
            if (updatePhotoError) {
              setWarning("The shop was created, but the photo path could not be saved.");
            }
          }
        } catch {
          setWarning("The photo could not be compressed before upload.");
        }
      }
    }

    setSuccess(editingShop ? "Shop updated." : "Shop created.");
    setSubmitting(false);
    setModalOpen(false);
    setEditingShop(null);
    await loadShops();
  };

  const saveUsualQuantities = async (shopId: string, usualQuantities: Record<string, string>) => {
    const supabase = createClient();
    if (!supabase) {
      return;
    }

    const entries = Object.entries(usualQuantities).filter(([, value]) => value.trim() !== "");
    const validEntries = entries.filter(([, value]) => !Number.isNaN(Number(value)));

    await Promise.all(
      validEntries.map(async ([productId, value]) => {
        await supabase.from("shop_products").upsert({
          shop_id: shopId,
          product_id: productId,
          usual_quantity: Number(value),
        }, { onConflict: "shop_id,product_id" });
      })
    );

    const currentProductIds = new Set(validEntries.map(([productId]) => productId));
    const rowsToDelete = products.filter((product) => !currentProductIds.has(product.id)).map((product) => product.id);
    await Promise.all(
      rowsToDelete.map(async (productId) => {
        await supabase.from("shop_products").delete().eq("shop_id", shopId).eq("product_id", productId);
      })
    );
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (!activeBusinessId) return;
    setExporting(true);
    const supabase = createClient();
    if (!supabase) {
      setError('Supabase client not available');
      setExporting(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('export_shops', { business_id_input: activeBusinessId });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const csv = Papa.unparse(rows.map((r) => ({
        Name: r.name,
        'Owner Name': r.owner_name,
        Phone: r.phone,
        Area: r.area,
        Address: r.address,
        Notes: r.notes,
        'Usual Order': r.usual_order_summary,
      })));

      const businessName = shops.find((s) => s.business_id === activeBusinessId)?.name ?? 'shops';
      const filename = `shops-export-${businessName}-${new Date().toISOString().slice(0,10)}.csv`;
      downloadCSV(csv, filename);
    } catch (err) {
      setError((err as Error).message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = (file: File | null) => {
    if (!file) return;
    setImportFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const rows = results.data as any[];
        setImportPreview(rows.slice(0, 5));
        setImportCount(rows.length);
      },
      error: (err: any) => setError(err.message),
    });
  };

  const handleImportConfirm = async (file: File | null) => {
    if (!file || !activeBusinessId) return;
    setImporting(true);
    setError(null);
    try {
      const parsed = await new Promise<any[]>((resolve, reject) => {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res: any) => resolve(res.data as any[]), error: (err: any) => reject(err) });
      });

      const shopsJson = parsed.map((row) => ({
        name: row['Name'] ?? row['name'],
        owner_name: row['Owner Name'] ?? row['owner_name'] ?? null,
        phone: row['Phone'] ?? row['phone'] ?? null,
        area: row['Area'] ?? row['area'] ?? null,
        address: row['Address'] ?? row['address'] ?? null,
        notes: row['Notes'] ?? row['notes'] ?? null,
      }));

      const supabase = createClient();
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error } = await supabase.rpc('import_shops', { business_id_input: activeBusinessId, shops_json: shopsJson });
      if (error) throw error;
      setSuccess(`Imported: ${data?.imported ?? 0}, Skipped: ${data?.skipped ?? 0}`);
      setImportOpen(false);
      await loadShops();
    } catch (err) {
      setError((err as Error).message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const toggleActive = async (shop: Shop) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      return;
    }

    const { error } = await supabase.from("shops").update({ is_active: !shop.is_active }).eq("id", shop.id).eq("business_id", activeBusinessId);

    if (!error) {
      await loadShops();
    }
  };

  if (businessLoading) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Shops</p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">Manage your retail partners</h1>
        </div>
        <div className="flex items-center gap-2">
          {activeBusinessRole === 'owner' ? (
            <>
              <Button onClick={() => void handleExport()} icon={Download} variant="outline">Export Shops</Button>
              <Button onClick={() => setImportOpen(true)} icon={Upload} variant="ghost">Import Shops</Button>
            </>
          ) : null}
          <Button onClick={() => { setEditingShop(null); setModalOpen(true); }} icon={Plus}>Add Shop</Button>
        </div>
      </Card>

      {error ? <div className="rounded-[1.35rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/70 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}
      {warning ? <div className="rounded-[1.35rem] border border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)]/70 p-3 text-sm text-[color:var(--warning)]">{warning}</div> : null}
      {success ? <div className="rounded-[1.35rem] border border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/70 p-3 text-sm text-[color:var(--success)]">{success}</div> : null}

      <Card padded={false} className="p-3">
        <div className="flex items-center gap-2 rounded-[1rem] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2">
          <Search className="h-4 w-4 text-[color:var(--muted)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by shop name or area" className="w-full border-0 bg-transparent p-0 text-sm focus:ring-0" />
        </div>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (<Skeleton key={index} className="h-36" />))}
        </div>
      ) : filteredShops.length === 0 ? (
        <EmptyState icon={Store} title="No shops yet" description="Add your first shop to start building your grounded distribution network." actionLabel="Add your first shop" onAction={() => setModalOpen(true)} />
      ) : (
        <>
          <div className="hidden md:block">
            <Card padded={false} className="overflow-hidden">
              <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
                <thead className="bg-[color:var(--cream)]/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Shop</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Area</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Contact</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                  {filteredShops.map((shop) => {
                    const isVisitedToday = visitedTodayShopIds.has(shop.id);

                    return (
                      <tr key={shop.id} className={isVisitedToday ? "bg-[color:var(--success-soft)]/25" : "bg-[color:var(--surface)]"}>
                        <td className="px-4 py-3 font-semibold text-[color:var(--ink)]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{shop.name}</span>
                            {isVisitedToday ? <Badge variant="success" className="gap-1"><CheckCircle className="h-3.5 w-3.5" />Visited today</Badge> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[color:var(--muted)]">{shop.area || "—"}</td>
                        <td className="px-4 py-3 text-[color:var(--muted)]">{shop.phone || shop.owner_name || "—"}</td>
                        <td className="px-4 py-3"><Badge variant={shop.is_active ? "success" : "warning"}>{shop.is_active ? "Active" : "Paused"}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/dashboard/shops/${shop.id}`} className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-sm font-semibold text-[color:var(--ink)]">View <ArrowRight className="h-4 w-4" /></Link>
                            <Button variant="ghost" icon={PencilLine} onClick={() => { setEditingShop(shop); setModalOpen(true); }}>Edit</Button>
                            <Button variant="outline" icon={shop.is_active ? ToggleLeft : ToggleRight} onClick={() => void toggleActive(shop)}>{shop.is_active ? "Pause" : "Restore"}</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
          <div className="grid gap-4 md:hidden">
            {filteredShops.map((shop) => {
              const isVisitedToday = visitedTodayShopIds.has(shop.id);

              return (
                <Card key={shop.id} className={isVisitedToday ? "border-[color:var(--success)] bg-[color:var(--success-soft)]/25" : "bg-[color:var(--surface)]"}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-[color:var(--ink)]">{shop.name}</h2>
                        {isVisitedToday ? <Badge variant="success" className="gap-1"><CheckCircle className="h-3.5 w-3.5" />Visited today</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">{shop.area || "Area not set"}</p>
                    </div>
                    <Badge variant={shop.is_active ? "success" : "warning"}>{shop.is_active ? "Active" : "Paused"}</Badge>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
                    <p>Phone: {shop.phone || "—"}</p>
                    <p>Owner: {shop.owner_name || "—"}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/dashboard/shops/${shop.id}`} className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-sm font-semibold text-[color:var(--ink)]">View <ArrowRight className="h-4 w-4" /></Link>
                    <Button variant="ghost" icon={PencilLine} onClick={() => { setEditingShop(shop); setModalOpen(true); }}>Edit</Button>
                    <Button variant="outline" icon={shop.is_active ? ToggleLeft : ToggleRight} onClick={() => void toggleActive(shop)}>{shop.is_active ? "Pause" : "Restore"}</Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <ShopFormModal
        open={modalOpen}
        mode={editingShop ? "edit" : "create"}
        shop={editingShop}
        products={products}
        shopProductDefaults={shopProductDefaults}
        onClose={() => { setModalOpen(false); setEditingShop(null); setError(null); setSuccess(null); }}
        onSubmit={handleCreateOrUpdate}
        submitting={submitting}
        error={error}
        success={success}
      />
      {importOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold">Import Shops (CSV)</h3>
            <p className="mt-2 text-sm text-[color:var(--muted)]">Upload a CSV with columns: Name, Owner Name, Phone, Area, Address, Notes. First row should be the header.</p>
            <div className="mt-4">
              <input type="file" accept=".csv" onChange={(e) => handleImportFile(e.target.files ? e.target.files[0] : null)} />
              {importFileName ? <p className="mt-2 text-sm">Selected: {importFileName} ({importCount} rows)</p> : null}
            </div>
            {importPreview.length ? (
              <div className="mt-4 overflow-auto max-h-40">
                <table className="min-w-full divide-y text-sm">
                  <thead className="bg-[color:var(--cream)]/70"><tr>{Object.keys(importPreview[0]).map((k) => (<th key={k} className="px-2 py-1 text-left font-semibold">{k}</th>))}</tr></thead>
                  <tbody className="divide-y">
                    {importPreview.map((row, idx) => (
                      <tr key={idx}>{Object.values(row).map((v, i) => (<td key={i} className="px-2 py-1 text-[color:var(--muted)]">{String(v)}</td>))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setImportOpen(false); setImportPreview([]); setImportFileName(null); }}>Cancel</Button>
              <Button onClick={async () => {
                const inputEl = document.querySelector('input[type=file]') as HTMLInputElement | null;
                const file = inputEl?.files?.[0] ?? null;
                await handleImportConfirm(file);
              }} disabled={importing}>{importing ? 'Importing...' : 'Import'}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
