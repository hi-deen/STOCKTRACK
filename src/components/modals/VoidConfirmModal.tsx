"use client";

import React, { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

type VoidType = "delivery" | "payment";

export default function VoidConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  type,
  item,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  type: VoidType;
  item: { id: string; shopName?: string | null; amount?: number | null; date?: string | null } | null;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-xl p-6">
        <Card>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[color:var(--danger)]">Void this {type}?</h3>

            <div className="rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[color:var(--ink)]">{item?.shopName ?? "—"}</p>
                  <p className="text-sm text-[color:var(--muted)]">{item?.date ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[color:var(--ink)]">{item?.amount != null ? `₦${Number(item.amount).toLocaleString('en-NG')}` : "—"}</p>
                  {item?.amount != null ? <Badge variant="warning">Will be removed</Badge> : null}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--ink)]">Reason for voiding (optional)</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate entry, Data entry error..." className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm" rows={4} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleConfirm} className="bg-[color:var(--danger)] text-white" disabled={submitting}>{submitting ? 'Voiding...' : 'Confirm Void'}</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
