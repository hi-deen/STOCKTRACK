"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product, Shop } from "@/types/phase2";
import { createClient } from "@/lib/supabase/client";

type DeliveryModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { shop_id: string; product_id: string; quantity: number; unit_price: number; delivery_date: string; notes: string }) => Promise<void>;
  submitting: boolean;
  error: string | null;
  success: string | null;
  shops: Shop[];
  products: Product[];
  defaultShopId?: string | null;
  defaultProductId?: string | null;
};

export default function DeliveryModal({ open, onClose, onSubmit, submitting, error, success, shops, products, defaultShopId, defaultProductId }: DeliveryModalProps) {
  const [shopQuery, setShopQuery] = useState("");
  const [selectedShopId, setSelectedShopId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const initialShop = shops.find((shop) => shop.id === defaultShopId) ?? null;
    const initialProduct = products.find((product) => product.id === defaultProductId) ?? null;

    setShopQuery(initialShop?.name ?? "");
    setSelectedShopId(initialShop?.id ?? "");
    setSelectedProductId(initialProduct?.id ?? "");
    setQuantity("1");
    setUnitPrice(initialProduct?.unit_price?.toString() ?? "");
    setDeliveryDate(today);
    setNotes("");
  }, [open, shops, products, defaultShopId, defaultProductId]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const filteredShops = useMemo(() => {
    const query = shopQuery.trim().toLowerCase();
    if (!query) {
      return shops.slice(0, 10);
    }

    return shops.filter((shop) => shop.name.toLowerCase().includes(query)).slice(0, 10);
  }, [shopQuery, shops]);

  const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId) ?? null, [products, selectedProductId]);
  const totalAmount = Number(quantity || 0) * Number(unitPrice || 0);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }
    setUnitPrice((selectedProduct.unit_price ?? 0).toString());
  }, [selectedProduct]);

  useEffect(() => {
    if (!open || !selectedShopId || !selectedProductId) {
      return;
    }

    let isActive = true;
    const loadUsualQuantity = async () => {
      const supabase = createClient();
      if (!supabase) {
        return;
      }

      const { data, error } = await supabase
        .from("shop_products")
        .select("usual_quantity")
        .eq("shop_id", selectedShopId)
        .eq("product_id", selectedProductId)
        .maybeSingle();

      if (!isActive || error) {
        return;
      }

      if (data?.usual_quantity != null && Number(data.usual_quantity) > 0) {
        setQuantity(String(data.usual_quantity));
      } else {
        setQuantity("1");
      }
    };

    void loadUsualQuantity();

    return () => {
      isActive = false;
    };
  }, [open, selectedShopId, selectedProductId]);

  if (!open) {
    return null;
  }

  const handleShopFocus = () => {
    if (selectedShopId) {
      setShopQuery("");
      setSelectedShopId("");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedShopId || !selectedProductId || !quantity || !unitPrice) {
      return;
    }

    await onSubmit({
      shop_id: selectedShopId,
      product_id: selectedProductId,
      quantity: Number(quantity),
      unit_price: Number(unitPrice),
      delivery_date: deliveryDate,
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-3 sm:px-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <h3 className="text-lg font-semibold text-slate-900">Record Delivery</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Shop</label>
                <input
                  required
                  value={shopQuery}
                  onFocus={handleShopFocus}
                  onChange={(event) => {
                    setShopQuery(event.target.value);
                    setSelectedShopId("");
                  }}
                  placeholder="Search shops"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                {filteredShops.length > 0 ? (
                  <div className="mt-2 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                    {filteredShops.map((shop) => (
                      <button
                        key={shop.id}
                        type="button"
                        onClick={() => {
                          setSelectedShopId(shop.id);
                          setShopQuery(shop.name);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {shop.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Product</label>
                <select required value={selectedProductId} onChange={(event) => {
                  setSelectedProductId(event.target.value);
                  setQuantity("1");
                }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Delivery Date</label>
                <input required type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
                <input required type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Unit Price</label>
                <input required type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-700">Total Amount</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">₦{totalAmount.toLocaleString("en-NG", { maximumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          </form>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
          <button type="submit" disabled={submitting} onClick={() => {
            const form = document.querySelector("form");
            if (form) {
              form.requestSubmit();
            }
          }} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
            {submitting ? "Saving..." : "Save Delivery"}
          </button>
        </div>
      </div>
    </div>
  );
}
