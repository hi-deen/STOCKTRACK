"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Minus, Plus, X } from "lucide-react";
import browserImageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/phase2";

type RouteShop = {
  id: string;
  name: string;
  area: string | null;
  address: string | null;
  phone: string | null;
  photo_path: string | null;
};

type RiderDeliveryModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  businessId: string;
  shop: RouteShop;
};

type ShopProductRow = {
  product_id: string;
  usual_quantity: number | null;
};

export default function RiderDeliveryModal({ open, onClose, onSaved, businessId, shop }: RiderDeliveryModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shopProductRows, setShopProductRows] = useState<ShopProductRow[]>([]);

  useEffect(() => {
    if (!open || !businessId || !shop.id) {
      return;
    }

    const loadProducts = async () => {
      const supabase = createClient();
      if (!supabase) {
        return;
      }

      const [productsRes, shopProductsRes] = await Promise.all([
        supabase.from("products").select("*").eq("business_id", businessId).eq("is_active", true).order("name"),
        supabase.from("shop_products").select("product_id, usual_quantity").eq("shop_id", shop.id),
      ]);

      if (productsRes.error || shopProductsRes.error) {
        setError((productsRes.error ?? shopProductsRes.error)?.message ?? "Unable to load products.");
        return;
      }

      const nextProducts = (productsRes.data ?? []) as Product[];
      const nextShopProductRows = (shopProductsRes.data ?? []) as ShopProductRow[];
      setProducts(nextProducts);
      setShopProductRows(nextShopProductRows);

      if (nextProducts.length > 0) {
        const firstProductId = nextProducts[0].id;
        const match = nextShopProductRows.find((entry) => entry.product_id === firstProductId);
        setSelectedProductId(firstProductId);
        setQuantity(match?.usual_quantity != null && Number(match.usual_quantity) > 0 ? String(match.usual_quantity) : "1");
      } else {
        setSelectedProductId("");
        setQuantity("1");
      }
    };

    void loadProducts();
  }, [open, businessId, shop.id]);

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

  useEffect(() => {
    if (!open) {
      setSelectedProductId("");
      setQuantity("1");
      setPhotoFile(null);
      setPhotoPreview(null);
      setSubmitting(false);
      setError(null);
      setShopProductRows([]);
      return;
    }
  }, [open]);

  const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId) ?? null, [products, selectedProductId]);

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    try {
      const compressedFile = await browserImageCompression(file, {
        maxSizeMB: 0.35,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
      });
      setPhotoFile(compressedFile);
      setPhotoPreview(URL.createObjectURL(compressedFile));
    } catch {
      setError("Unable to compress the selected photo.");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedProductId || !quantity || !photoFile) {
      setError("Choose a product, quantity, and photo before submitting.");
      return;
    }

    const token = window.localStorage.getItem("rider_session_token");
    if (!token) {
      setError("Your rider session expired. Please log in again.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setSubmitting(false);
      return;
    }

    const extension = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${businessId}/${shop.id}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("delivery-proofs").upload(filePath, photoFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: photoFile.type || "image/jpeg",
    });

    if (uploadError) {
      setError(uploadError.message);
      setSubmitting(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("record_rider_delivery", {
      token_input: token,
      shop_id_input: shop.id,
      product_id_input: selectedProductId,
      quantity_input: Number(quantity),
      proof_photo_path_input: filePath,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onSaved();
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 px-3 py-3 sm:px-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Rider Delivery</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{shop.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close delivery modal">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-900">{shop.address || "No address on file"}</p>
            <p className="mt-1 text-sm text-slate-600">{shop.area ? `Area: ${shop.area}` : "Area not set"}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Product</label>
            <select value={selectedProductId} onChange={(event) => {
              const nextProductId = event.target.value;
              const match = shopProductRows.find((entry) => entry.product_id === nextProductId);
              setSelectedProductId(nextProductId);
              if (match?.usual_quantity != null && Number(match.usual_quantity) > 0) {
                setQuantity(String(match.usual_quantity));
              } else {
                setQuantity("1");
              }
            }} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">
              <option value="">Select product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name} ({product.unit})</option>
              ))}
            </select>
            {selectedProduct ? <p className="mt-1 text-xs text-slate-500">Unit price: ₦{Number(selectedProduct.unit_price).toLocaleString("en-NG")}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQuantity((current) => String(Math.max(1, Number(current || 1) - 1)))} className="rounded-full border border-slate-300 p-2 text-slate-700">
                <Minus className="h-4 w-4" />
              </button>
              <input type="number" min="1" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
              <button type="button" onClick={() => setQuantity((current) => String(Number(current || 1) + 1))} className="rounded-full border border-slate-300 p-2 text-slate-700">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Proof photo</label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
              <Camera className="mb-2 h-6 w-6 text-[color:var(--primary)]" />
              <span>{photoFile ? photoFile.name : "Tap to take or select a photo"}</span>
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handlePhotoChange} />
            </label>
            {photoPreview ? <img src={photoPreview} alt="Selected proof preview" className="mt-3 h-48 w-full rounded-2xl object-cover" /> : null}
          </div>

          {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </form>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
          <button type="submit" disabled={submitting} onClick={() => {
            const form = document.querySelector("form");
            if (form) {
              form.requestSubmit();
            }
          }} className="rounded-xl bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
            {submitting ? "Saving..." : "Save delivery"}
          </button>
        </div>
      </div>
    </div>
  );
}
