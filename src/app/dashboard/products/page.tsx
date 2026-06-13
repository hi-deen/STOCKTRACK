"use client";

import { useEffect, useMemo, useState } from "react";
import { useBusiness } from "@/components/providers/business-provider";
import ProductFormModal from "@/components/phase2/product-form-modal";
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
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("business_id", activeBusinessId)
      .order("created_at", { ascending: false });

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
      const { error } = await supabase
        .from("products")
        .update({
          name: payload.name,
          unit: payload.unit,
          unit_price: payload.unit_price,
        })
        .eq("id", editingProduct.id)
        .eq("business_id", activeBusinessId);

      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }
    } else {
      const { error } = await supabase.from("products").insert({
        business_id: activeBusinessId,
        name: payload.name,
        unit: payload.unit,
        unit_price: payload.unit_price,
      });

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

    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id)
      .eq("business_id", activeBusinessId);

    if (!error) {
      await loadProducts();
    }
  };

  if (businessLoading) {
    return <p className="text-sm text-slate-600">Loading business context…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Products</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">Manage your product catalog</h1>
        </div>
        <button onClick={() => { setEditingProduct(null); setModalOpen(true); }} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Add Product
        </button>
      </div>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-600">Loading products…</p>
      ) : activeProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No products yet</h2>
          <p className="mt-2 text-sm text-slate-600">Add your first product to start tracking catalog pricing.</p>
          <button onClick={() => setModalOpen(true)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Add your first product
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Unit</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Unit Price</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {activeProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
                  <td className="px-4 py-3 text-slate-700">{product.unit}</td>
                  <td className="px-4 py-3 text-slate-700">{product.unit_price.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setEditingProduct(product); setModalOpen(true); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">Edit</button>
                      <button onClick={() => void toggleActive(product)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">Deactivate</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductFormModal
        open={modalOpen}
        mode={editingProduct ? "edit" : "create"}
        product={editingProduct}
        onClose={() => { setModalOpen(false); setEditingProduct(null); setError(null); setSuccess(null); }}
        onSubmit={handleCreateOrUpdate}
        submitting={submitting}
        error={error}
        success={success}
      />
    </div>
  );
}
