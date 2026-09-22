"use client";

import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle, Settings as SettingsIcon } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

type SettingsFormState = {
  displayName: string;
  paymentDays: string;
  restockDays: string;
};

export default function SettingsPage() {
  const { activeBusinessId, activeBusinessRole, businesses } = useBusiness();
  const [form, setForm] = useState<SettingsFormState>({ displayName: "", paymentDays: "14", restockDays: "7" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const supabase = createClient();
      if (!supabase || !activeBusinessId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("business_settings")
        .select("payment_reminder_days, restock_reminder_days, business_display_name")
        .eq("business_id", activeBusinessId)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const businessName = businesses.find((business) => business.id === activeBusinessId)?.name ?? "";
      setForm({
        displayName: data?.business_display_name ?? businessName,
        paymentDays: String(data?.payment_reminder_days ?? 14),
        restockDays: String(data?.restock_reminder_days ?? 7),
      });
      setLoading(false);
    };

    void loadSettings();
  }, [activeBusinessId, businesses]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Unable to save settings right now.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    const { error } = await supabase.rpc("upsert_business_settings", {
      business_id_input: activeBusinessId,
      payment_days: Number(form.paymentDays),
      restock_days: Number(form.restockDays),
      display_name: form.displayName.trim(),
    });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setSuccess("Business settings updated.");
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Preferences</p>
        <h1 className="text-2xl font-semibold text-[color:var(--ink)]">Settings</h1>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading settings...
          </div>
        ) : activeBusinessRole !== "owner" ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-[1.2rem] border border-[color:var(--border)] bg-[color:var(--cream)]/70 p-4">
              <SettingsIcon className="mt-0.5 h-5 w-5 text-[color:var(--primary)]" />
              <div>
                <p className="font-semibold text-[color:var(--ink)]">Only the business owner can change these settings</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">Current values are shown below for reference.</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-[color:var(--ink)]">
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
                <p className="font-semibold">Display name</p>
                <p className="mt-1 text-[color:var(--muted)]">{form.displayName || "Not set"}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
                <p className="font-semibold">Payment reminder days</p>
                <p className="mt-1 text-[color:var(--muted)]">{form.paymentDays}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3">
                <p className="font-semibold">Restock reminder days</p>
                <p className="mt-1 text-[color:var(--muted)]">{form.restockDays}</p>
              </div>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSave}>
            <div>
              <label className="mb-1 block text-sm font-semibold text-[color:var(--ink)]" htmlFor="display-name">
                Display name for messages
              </label>
              <input id="display-name" value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Acme Distribution" className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--primary)]" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-[color:var(--ink)]" htmlFor="payment-days">
                  Days before flagging unpaid balance
                </label>
                <input id="payment-days" type="number" min="1" value={form.paymentDays} onChange={(event) => setForm((current) => ({ ...current, paymentDays: event.target.value }))} className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--primary)]" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-[color:var(--ink)]" htmlFor="restock-days">
                  Days before flagging shop for restock
                </label>
                <input id="restock-days" type="number" min="1" value={form.restockDays} onChange={(event) => setForm((current) => ({ ...current, restockDays: event.target.value }))} className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--primary)]" />
              </div>
            </div>
            {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
            {success ? <p className="text-sm text-[color:var(--success)]">{success}</p> : null}
            <Button type="submit" disabled={saving} icon={saving ? LoaderCircle : SettingsIcon}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
