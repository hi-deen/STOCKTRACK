"use client";

import { useEffect, useState } from "react";
import type { Shop } from "@/types/phase2";

type ShopFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  shop?: Shop | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; owner_name: string; phone: string; area: string; address: string; notes: string }) => Promise<void>;
  submitting: boolean;
  error: string | null;
  success: string | null;
};

export default function ShopFormModal({ open, mode, shop, onClose, onSubmit, submitting, error, success }: ShopFormModalProps) {
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setName(shop?.name ?? "");
      setOwnerName(shop?.owner_name ?? "");
      setPhone(shop?.phone ?? "");
      setArea(shop?.area ?? "");
      setAddress(shop?.address ?? "");
      setNotes(shop?.notes ?? "");
    }
  }, [open, shop]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      name: name.trim(),
      owner_name: ownerName.trim(),
      phone: phone.trim(),
      area: area.trim(),
      address: address.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{mode === "create" ? "Add Shop" : "Edit Shop"}</h3>
          <button onClick={onClose} className="text-sm text-slate-500">Close</button>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Shop Name</label>
            <input required value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Owner Name</label>
              <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Area</label>
              <input value={area} onChange={(event) => setArea(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
              <input value={address} onChange={(event) => setAddress(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
              {submitting ? "Saving..." : mode === "create" ? "Create Shop" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
