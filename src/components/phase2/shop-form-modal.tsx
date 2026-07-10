"use client";

import { useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product, Shop } from "@/types/phase2";
import { useSignedPhotoUrl } from "@/lib/supabase/photo";

type ShopFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  shop?: Shop | null;
  products?: Product[];
  shopProductDefaults?: Record<string, string>;
  onClose: () => void;
  onSubmit: (payload: { name: string; owner_name: string; phone: string; area: string; address: string; notes: string; photoFile?: File | null; removePhoto?: boolean; usualQuantities: Record<string, string> }) => Promise<void>;
  submitting: boolean;
  error: string | null;
  success: string | null;
  warning?: string | null;
};

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string };
type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string };

type FormFieldProps = {
  label: string;
  children: ReactNode;
};

function FormField({ label, children }: FormFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function InputField({ label, className = "", ...props }: InputFieldProps) {
  return (
    <FormField label={label}>
      <input {...props} className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${className}`.trim()} />
    </FormField>
  );
}

function TextareaField({ label, className = "", ...props }: TextareaFieldProps) {
  return (
    <FormField label={label}>
      <textarea {...props} className={`h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${className}`.trim()} />
    </FormField>
  );
}

export default function ShopFormModal({ open, mode, shop, products = [], shopProductDefaults = {}, onClose, onSubmit, submitting, error, success, warning }: ShopFormModalProps) {
  const [formData, setFormData] = useState({ name: "", owner_name: "", phone: "", area: "", address: "", notes: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [showUsualOrder, setShowUsualOrder] = useState(false);
  const [usualQuantities, setUsualQuantities] = useState<Record<string, string>>({});
  const [existingAreas, setExistingAreas] = useState<string[]>([]);
  const existingPhotoUrl = useSignedPhotoUrl(shop?.photo_path ?? null);

  const previewUrl = useMemo(() => photoPreviewUrl ?? existingPhotoUrl ?? null, [photoPreviewUrl, existingPhotoUrl]);
  const activeProducts = useMemo(() => products.filter((product) => product.is_active), [products]);

  useEffect(() => {
    if (open) {
      setFormData({
        name: shop?.name ?? "",
        owner_name: shop?.owner_name ?? "",
        phone: shop?.phone ?? "",
        area: shop?.area ?? "",
        address: shop?.address ?? "",
        notes: shop?.notes ?? "",
      });
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      setRemovePhoto(false);
      setShowUsualOrder(false);
      setUsualQuantities(shopProductDefaults);
    }
  }, [open, shop, shopProductDefaults]);

  useEffect(() => {
    if (!open) return;

    let isActive = true;
    const loadAreas = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const { data, error } = await supabase.from("shops").select("area");
      if (!isActive || error) return;

      const areas = Array.from(new Set((data ?? []).map((r: any) => r.area).filter(Boolean)));
      setExistingAreas(areas as string[]);
    };

    void loadAreas();

    return () => {
      isActive = false;
    };
  }, [open]);

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

  if (!open) {
    return null;
  }

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setRemovePhoto(false);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(objectUrl);
    setPhotoFile(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      name: formData.name.trim(),
      owner_name: formData.owner_name.trim(),
      phone: formData.phone.trim(),
      area: formData.area.trim(),
      address: formData.address.trim(),
      notes: formData.notes.trim(),
      photoFile,
      removePhoto,
      usualQuantities,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-3 sm:px-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <h3 className="text-lg font-semibold text-slate-900">{mode === "create" ? "Add Shop" : "Edit Shop"}</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
              <InputField label="Shop Name" required value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Owner Name" value={formData.owner_name} onChange={(event) => setFormData((prev) => ({ ...prev, owner_name: event.target.value }))} />
              <InputField label="Phone" value={formData.phone} onChange={(event) => setFormData((prev) => ({ ...prev, phone: event.target.value }))} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Area" list="areas-list" value={formData.area} onChange={(event) => setFormData((prev) => ({ ...prev, area: event.target.value }))} />
              <datalist id="areas-list">
                {existingAreas.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>

              <InputField label="Address" value={formData.address} onChange={(event) => setFormData((prev) => ({ ...prev, address: event.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Photo <span className="text-xs text-slate-500">(optional)</span></label>
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              {previewUrl ? (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <img src={previewUrl} alt="Shop preview" className="h-16 w-16 rounded-xl object-cover" />
                  <div className="text-sm text-slate-600">
                    <p className="font-medium text-slate-800">{photoFile ? "New photo selected" : "Current shop photo"}</p>
                    <p>{photoFile ? "This will replace the existing image after save." : "The current photo will stay unless you remove it."}</p>
                  </div>
                </div>
              ) : null}
              {shop?.photo_path ? (
                <button type="button" onClick={() => { setRemovePhoto(true); setPhotoFile(null); setPhotoPreviewUrl(null); }} className="mt-2 text-sm font-semibold text-rose-600">
                  Remove photo
                </button>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <button type="button" onClick={() => setShowUsualOrder((current) => !current)} className="flex w-full items-center justify-between text-sm font-semibold text-slate-800">
                <span>Usual Order (optional)</span>
                <span>{showUsualOrder ? "Hide" : "Show"}</span>
              </button>
              {showUsualOrder ? (
                <div className="mt-3 space-y-2">
                  {activeProducts.length === 0 ? (
                    <p className="text-sm text-slate-500">No active products yet. Add products first to set usual quantities.</p>
                  ) : (
                    activeProducts.map((product) => (
                      <div key={product.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                        <span className="flex-1 text-sm text-slate-700">{product.name} ({product.unit})</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={usualQuantities[product.id] ?? ""}
                          onChange={(event) => setUsualQuantities((current) => ({ ...current, [product.id]: event.target.value }))}
                          placeholder="0"
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
              <TextareaField label="Notes" value={formData.notes} onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))} />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {warning ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">{warning}</p> : null}
            {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          </form>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={submitting} onClick={() => {
            const form = document.querySelector("form");
            if (form) {
              form.requestSubmit();
            }
          }} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
            {submitting ? "Saving..." : mode === "create" ? "Create Shop" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
