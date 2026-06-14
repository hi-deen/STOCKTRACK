"use client";

import { useEffect, useMemo, useState } from "react";
import type { Shop } from "@/types/phase2";

type ReminderModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { shop_id: string; type: string; title: string; message: string; due_date: string }) => Promise<void>;
  submitting: boolean;
  error: string | null;
  success: string | null;
  shops: Shop[];
  defaultShopId?: string | null;
};

const types = ["payment", "restock", "custom"];

export default function ReminderModal({ open, onClose, onSubmit, submitting, error, success, shops, defaultShopId }: ReminderModalProps) {
  const [shopQuery, setShopQuery] = useState("");
  const [selectedShopId, setSelectedShopId] = useState("");
  const [type, setType] = useState("payment");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialShop = shops.find((shop) => shop.id === defaultShopId) ?? null;
    setShopQuery(initialShop?.name ?? "");
    setSelectedShopId(initialShop?.id ?? "");
    setType("payment");
    setTitle("");
    setMessage("");
    setDueDate(new Date().toISOString().slice(0, 10));
  }, [open, shops, defaultShopId]);

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
    if (!selectedShopId || !title.trim() || !message.trim()) {
      return;
    }

    await onSubmit({
      shop_id: selectedShopId,
      type,
      title: title.trim(),
      message: message.trim(),
      due_date: dueDate,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-3 sm:px-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <h3 className="text-lg font-semibold text-slate-900">Add Reminder</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
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
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
                <select value={type} onChange={(event) => setType(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {types.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label>
                <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
              <input required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
              <textarea required value={message} onChange={(event) => setMessage(event.target.value)} className="h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-slate-500">Use plain text. Placeholders are already resolved when you create a reminder.</p>
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
            {submitting ? "Saving..." : "Create Reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}
