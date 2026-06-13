"use client";

import { useEffect, useMemo, useState } from "react";
import type { Shop } from "@/types/phase2";

type PaymentModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { shop_id: string; amount: number; payment_date: string; method: string; notes: string }) => Promise<void>;
  submitting: boolean;
  error: string | null;
  success: string | null;
  shops: Shop[];
  defaultShopId?: string | null;
};

const methods = ["cash", "transfer", "POS", "other"];

export default function PaymentModal({ open, onClose, onSubmit, submitting, error, success, shops, defaultShopId }: PaymentModalProps) {
  const [shopQuery, setShopQuery] = useState("");
  const [selectedShopId, setSelectedShopId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialShop = shops.find((shop) => shop.id === defaultShopId) ?? null;
    setShopQuery(initialShop?.name ?? "");
    setSelectedShopId(initialShop?.id ?? "");
    setAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMethod("cash");
    setNotes("");
  }, [open, shops, defaultShopId]);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedShopId || !amount) {
      return;
    }

    await onSubmit({
      shop_id: selectedShopId,
      amount: Number(amount),
      payment_date: paymentDate,
      method,
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Record Payment</h3>
          <button onClick={onClose} className="text-sm text-slate-500">Close</button>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Shop</label>
            <input
              required
              value={shopQuery}
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
              <input required type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Payment Date</label>
              <input required type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Method</label>
            <select value={method} onChange={(event) => setMethod(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {methods.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
              {submitting ? "Saving..." : "Save Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
