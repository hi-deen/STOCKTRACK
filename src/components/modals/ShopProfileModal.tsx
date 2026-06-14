"use client";

import { Store, Phone, MapPin, User, Wallet, CalendarClock, ClipboardList } from "lucide-react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useSignedPhotoUrl } from "@/lib/supabase/photo";
import type { Shop } from "@/types/phase2";

function formatCurrency(value: number) {
  return `₦${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

type ShopProfileModalProps = {
  open: boolean;
  shop: Shop | null;
  balance: number;
  lastRestockedLabel: string;
  lastPaymentLabel: string;
  onClose: () => void;
  onEdit: () => void;
};

export default function ShopProfileModal({ open, shop, balance, lastRestockedLabel, lastPaymentLabel, onClose, onEdit }: ShopProfileModalProps) {
  const signedPhotoUrl = useSignedPhotoUrl(shop?.photo_path ?? null);

  if (!open || !shop) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-3 py-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[1.6rem] border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xl">
        <div className="border-b border-[color:var(--border)] px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[color:var(--cream)]">
                {signedPhotoUrl ? <img src={signedPhotoUrl} alt={shop.name} className="h-full w-full object-cover" /> : <Store className="h-7 w-7 text-[color:var(--primary)]" />}
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Shop profile</p>
                <h3 className="mt-1 text-xl font-semibold text-[color:var(--ink)]">{shop.name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {shop.area ? <Badge variant="info">{shop.area}</Badge> : null}
                  <Badge variant={balance > 0 ? "danger" : "success"}>{balance > 0 ? "Outstanding" : "Settled"}</Badge>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-sm font-semibold text-[color:var(--muted)]">Close</button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <Card padded={false} className="p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <User className="h-4 w-4 text-[color:var(--primary)]" />
                <span>Contact details</span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
                {shop.owner_name ? <p><span className="font-semibold text-[color:var(--ink)]">Owner:</span> {shop.owner_name}</p> : null}
                {shop.phone ? <p><span className="font-semibold text-[color:var(--ink)]">Phone:</span> <a href={`tel:${shop.phone}`} className="text-[color:var(--primary)]">{shop.phone}</a></p> : null}
                {shop.address ? <p><span className="font-semibold text-[color:var(--ink)]">Address:</span> {shop.address}</p> : null}
                {shop.notes ? <p><span className="font-semibold text-[color:var(--ink)]">Notes:</span> {shop.notes}</p> : null}
              </div>
            </Card>

            <Card padded={false} className="p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--ink)]">
                <Wallet className="h-4 w-4 text-[color:var(--primary)]" />
                <span>Current status</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className={`rounded-[1rem] border p-3 ${balance > 0 ? "border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/45 text-[color:var(--danger)]" : "border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/45 text-[color:var(--success)]"}`}>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em]">Balance</p>
                  <p className="mt-1 text-2xl font-semibold">{formatCurrency(balance)}</p>
                </div>
                <div className="rounded-[1rem] border border-[color:var(--border)] bg-[color:var(--cream)]/50 p-3 text-sm text-[color:var(--muted)]">
                  <div className="flex items-center gap-2 font-semibold text-[color:var(--ink)]">
                    <CalendarClock className="h-4 w-4" />
                    <span>Latest follow-up</span>
                  </div>
                  <p className="mt-2">{lastRestockedLabel}</p>
                  <p className="mt-1">{lastPaymentLabel}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button href={`/dashboard/shops/${shop.id}`} icon={ClipboardList}>View Full History</Button>
            <Button variant="outline" onClick={onEdit}>Edit Shop</Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
