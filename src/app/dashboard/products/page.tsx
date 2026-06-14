"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, PencilLine, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import ProductFormModal from "@/components/phase2/product-form-modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/phase2";

export default function ProductsPage() {
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProducts = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").eq("business_id", activeBusinessId).order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setProducts((data ?? []) as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadProducts();
  }, [activeBusinessId]);

  const activeProducts = useMemo(() => products.filter((product) => product.is_active), [products]);

  const handleCreateOrUpdate = async (payload: { name: string; unit: string; unit_price: number }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (editingProduct) {
      const { error } = await supabase.from("products").update({ name: payload.name, unit: payload.unit, unit_price: payload.unit_price }).eq("id", editingProduct.id).eq("business_id", activeBusinessId);

      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }
    } else {
      const { error } = await supabase.from("products").insert({ business_id: activeBusinessId, name: payload.name, unit: payload.unit, unit_price: payload.unit_price });

      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }
    }

    setSuccess(editingProduct ? "Product updated." : "Product created.");
    setSubmitting(false);
    setModalOpen(false);
    setEditingProduct(null);
    await loadProducts();
  };

  const toggleActive = async (product: Product) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      return;
    }

    const { error } = await supabase.from("products").update({ is_active: !product.is_active }).eq("id", product.id).eq("business_id", activeBusinessId);

    if (!error) {
      await loadProducts();
    }
  };

  if (businessLoading) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Products</p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">Manage your product catalog</h1>
        </div>
        <Button onClick={() => { setEditingProduct(null); setModalOpen(true); }} icon={Plus}>Add Product</Button>
      </Card>

      {error ? <div className="rounded-[1.35rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/70 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}
      {success ? <div className="rounded-[1.35rem] border border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/70 p-3 text-sm text-[color:var(--success)]">{success}</div> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (<Skeleton key={index} className="h-32" />))}
        </div>
      ) : activeProducts.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" description="Add your first product to start tracking catalog pricing and delivery value." actionLabel="Add your first product" onAction={() => setModalOpen(true)} />
      ) : (
        <>
          <div className="hidden md:block">
            <Card padded={false} className="overflow-hidden">
              <table className="min-w-full divide-y divide-[color:var(--border)] text-sm">
                <thead className="bg-[color:var(--cream)]/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Unit</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Unit Price</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-[color:var(--ink)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--surface)]">
                  {activeProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3 font-semibold text-[color:var(--ink)]">{product.name}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">{product.unit}</td>
                      <td className="px-4 py-3 text-[color:var(--muted)]">₦{product.unit_price.toLocaleString("en-NG")}</td>
                      <td className="px-4 py-3"><Badge variant={product.is_active ? "success" : "warning"}>{product.is_active ? "Active" : "Paused"}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" icon={PencilLine} onClick={() => { setEditingProduct(product); setModalOpen(true); }}>Edit</Button>
                          <Button variant="outline" icon={product.is_active ? ToggleLeft : ToggleRight} onClick={() => void toggleActive(product)}>{product.is_active ? "Pause" : "Restore"}</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
          <div className="grid gap-4 md:hidden">
            {activeProducts.map((product) => (
              <Card key={product.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[color:var(--ink)]">{product.name}</h2>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">{product.unit}</p>
                  </div>
                  <Badge variant={product.is_active ? "success" : "warning"}>{product.is_active ? "Active" : "Paused"}</Badge>
                </div>
                <p className="mt-4 text-sm text-[color:var(--muted)]">Unit price: ₦{product.unit_price.toLocaleString("en-NG")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="ghost" icon={PencilLine} onClick={() => { setEditingProduct(product); setModalOpen(true); }}>Edit</Button>
                  <Button variant="outline" icon={product.is_active ? ToggleLeft : ToggleRight} onClick={() => void toggleActive(product)}>{product.is_active ? "Pause" : "Restore"}</Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <ProductFormModal open={modalOpen} mode={editingProduct ? "edit" : "create"} product={editingProduct} onClose={() => { setModalOpen(false); setEditingProduct(null); setError(null); setSuccess(null); }} onSubmit={handleCreateOrUpdate} submitting={submitting} error={error} success={success} />
    </div>
  );
}
