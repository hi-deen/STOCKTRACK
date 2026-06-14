"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, MessageCircle, Plus, Sparkles, XCircle } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import ReminderModal from "@/components/phase4/reminder-modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Reminder, ReminderSuggestion } from "@/types/phase4";
import type { Shop } from "@/types/phase2";

function getBadgeVariant(type: Reminder["type"]) {
  switch (type) {
    case "payment":
      return "warning" as const;
    case "restock":
      return "success" as const;
    default:
      return "info" as const;
  }
}

function getWhatsAppLink(phone: string | null, message: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  const encoded = encodeURIComponent(message);
  return normalized ? `https://wa.me/${normalized}?text=${encoded}` : "";
}

export default function RemindersPage() {
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [suggestions, setSuggestions] = useState<ReminderSuggestion[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reloadData = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setReminders([]);
      setSuggestions([]);
      setShops([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [remindersRes, suggestionsRes, shopsRes] = await Promise.all([
      supabase.from("reminders").select("*").eq("business_id", activeBusinessId).order("due_date", { ascending: true }).order("created_at", { ascending: false }),
      supabase.rpc("get_reminder_suggestions", { business_id_input: activeBusinessId }),
      supabase.from("shops").select("*").eq("business_id", activeBusinessId).order("name"),
    ]);

    if (remindersRes.error) {
      setError(remindersRes.error.message);
      setLoading(false);
      return;
    }

    const allReminders = (remindersRes.data ?? []) as Reminder[];
    const allSuggestions = (suggestionsRes.data ?? []) as ReminderSuggestion[];
    const shopList = (shopsRes.data ?? []) as Shop[];
    const shopMap = new Map(shopList.map((shop) => [shop.id, shop.name]));
    const phoneMap = new Map(shopList.map((shop) => [shop.id, shop.phone]));

    setReminders(allReminders.map((reminder) => ({ ...reminder, shop_name: shopMap.get(reminder.shop_id), shop_phone: phoneMap.get(reminder.shop_id) ?? null })));
    setSuggestions(allSuggestions);
    setShops((shopsRes.data ?? []) as Shop[]);
    setLoading(false);
  };

  useEffect(() => {
    void reloadData();
  }, [activeBusinessId]);

  const overdueAndDueToday = useMemo(() => reminders.filter((reminder) => reminder.status === "pending" && reminder.due_date <= new Date().toISOString().slice(0, 10)).sort((a, b) => a.due_date.localeCompare(b.due_date)), [reminders]);
  const upcoming = useMemo(() => reminders.filter((reminder) => reminder.status === "pending" && reminder.due_date > new Date().toISOString().slice(0, 10) && new Date(reminder.due_date).getTime() - new Date().setHours(0, 0, 0, 0) <= 14 * 24 * 60 * 60 * 1000), [reminders]);
  const completed = useMemo(() => reminders.filter((reminder) => reminder.status !== "pending").slice(0, 20), [reminders]);

  const handleCreate = async (payload: { shop_id: string; type: string; title: string; message: string; due_date: string }) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const { error } = await supabase.from("reminders").insert({
      business_id: activeBusinessId,
      shop_id: payload.shop_id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      due_date: payload.due_date,
      status: "pending",
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setSuccess("Reminder created.");
    setSubmitting(false);
    setModalOpen(false);
    await reloadData();
  };

  const updateReminder = async (id: string, updates: Partial<Reminder>) => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setError("Select a business first.");
      return;
    }

    const { error } = await supabase.from("reminders").update(updates).eq("id", id).eq("business_id", activeBusinessId);
    if (error) {
      setError(error.message);
      return;
    }

    await reloadData();
  };

  const openWhatsApp = (phone: string | null, message: string) => {
    const url = getWhatsAppLink(phone, message);
    if (!url) {
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const renderReminderRows = (items: Reminder[]) => (
    <div className="space-y-3">
      {items.map((reminder) => (
        <Card key={reminder.id} className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--ink)]">{reminder.shop_name ?? "Unknown shop"}</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">{reminder.title}</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]/80">{reminder.message}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant={getBadgeVariant(reminder.type)}>{reminder.type}</Badge>
              <span className="text-sm text-[color:var(--muted)]">Due {reminder.due_date}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void updateReminder(reminder.id, { status: "done", completed_at: new Date().toISOString() })} icon={CheckCircle2}>Mark Done</Button>
            <Button variant="ghost" onClick={() => void updateReminder(reminder.id, { status: "dismissed" })} icon={XCircle}>Dismiss</Button>
            <Button variant="outline" onClick={() => void updateReminder(reminder.id, { due_date: new Date(new Date(reminder.due_date).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) })}>Snooze 3 days</Button>
            <Button variant="secondary" onClick={() => openWhatsApp(reminder.shop_phone ?? null, reminder.message)} icon={MessageCircle}>WhatsApp</Button>
          </div>
        </Card>
      ))}
    </div>
  );

  if (businessLoading) {
    return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Reminders</p>
          <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-semibold text-[color:var(--ink)]">Follow up with shops and automate nudges</h1>
        </div>
        <Button onClick={() => setModalOpen(true)} icon={Plus}>Add Reminder</Button>
      </Card>

      {error ? <div className="rounded-[1.35rem] border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]/70 p-3 text-sm text-[color:var(--danger)]">{error}</div> : null}
      {success ? <div className="rounded-[1.35rem] border border-[color:var(--success-soft)] bg-[color:var(--success-soft)]/70 p-3 text-sm text-[color:var(--success)]">{success}</div> : null}

      <div className="space-y-6">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <BellRing className="h-5 w-5 text-[color:var(--primary)]" />
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Overdue & Due Today</h2>
          </div>
          {loading ? <div className="space-y-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div> : overdueAndDueToday.length === 0 ? <EmptyState icon={BellRing} title="All clear" description="There are no reminders due right now. Your follow-up list is calm for the moment." /> : renderReminderRows(overdueAndDueToday)}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[color:var(--accent)]" />
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Upcoming</h2>
          </div>
          {loading ? <div className="space-y-3"><Skeleton className="h-28" /></div> : upcoming.length === 0 ? <EmptyState icon={Sparkles} title="No upcoming nudges" description="Nothing is scheduled in the next 14 days." /> : renderReminderRows(upcoming)}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[color:var(--accent)]" />
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Suggested</h2>
          </div>
          {loading ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : suggestions.length === 0 ? <EmptyState icon={Sparkles} title="No suggestions right now" description="Once a shop needs attention, smart follow-up ideas will appear here." /> : (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <Card key={`${suggestion.shop_id}-${suggestion.type}`} className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--ink)]">{suggestion.shop_name}</p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">{suggestion.reason}</p>
                      <p className="mt-2 text-sm text-[color:var(--muted)]/80">{suggestion.suggested_message}</p>
                    </div>
                    <Badge variant={suggestion.type === "payment" ? "warning" : "success"}>{suggestion.type}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void handleCreate({ shop_id: suggestion.shop_id, type: suggestion.type, title: suggestion.type === "payment" ? "Payment reminder" : "Restock reminder", message: suggestion.suggested_message, due_date: new Date().toISOString().slice(0, 10) })}>Add as Reminder</Button>
                    <Button variant="secondary" onClick={() => openWhatsApp(suggestion.shop_phone, suggestion.suggested_message)} icon={MessageCircle}>WhatsApp</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[color:var(--success)]" />
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">Completed / Dismissed</h2>
          </div>
          {completed.length === 0 ? <EmptyState icon={CheckCircle2} title="No completed reminders" description="Closed follow-ups will stay here for easy review later." /> : renderReminderRows(completed)}
        </section>
      </div>

      <ReminderModal open={modalOpen} onClose={() => { setModalOpen(false); setError(null); setSuccess(null); }} onSubmit={handleCreate} submitting={submitting} error={error} success={success} shops={shops} />
    </div>
  );
}
