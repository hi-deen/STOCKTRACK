"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/types/phase2";

const unitOptions = ["carton", "bag", "liter", "piece", "custom"];

type ProductFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  product?: Product | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; unit: string; unit_price: number }) => Promise<void>;
  submitting: boolean;
  error: string | null;
  success: string | null;
};

export default function ProductFormModal({ open, mode, product, onClose, onSubmit, submitting, error, success }: ProductFormModalProps) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("carton");
  const [customUnit, setCustomUnit] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setUnit(product?.unit ?? "carton");
      setCustomUnit("");
      setUnitPrice(product?.unit_price?.toString() ?? "");
    }
  }, [open, product]);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const resolvedUnit = unit === "custom" ? customUnit.trim() : unit;

    await onSubmit({
      name: name.trim(),
      unit: resolvedUnit,
      unit_price: Number(unitPrice),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-3 sm:px-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <h3 className="text-lg font-semibold text-slate-900">{mode === "create" ? "Add Product" : "Edit Product"}</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
              <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Unit</label>
              <select value={unit} onChange={(event) => setUnit(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {unitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            {unit === "custom" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Custom Unit</label>
                <input required value={customUnit} onChange={(event) => setCustomUnit(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Unit Price</label>
              <input required type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
            {submitting ? "Saving..." : mode === "create" ? "Create Product" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
