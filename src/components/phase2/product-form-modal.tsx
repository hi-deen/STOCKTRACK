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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{mode === "create" ? "Add Product" : "Edit Product"}</h3>
          <button onClick={onClose} className="text-sm text-slate-500">Close</button>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
              {submitting ? "Saving..." : mode === "create" ? "Create Product" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
