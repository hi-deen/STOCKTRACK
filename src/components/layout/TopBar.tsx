"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, MoreVertical, Package, Store, Copy, LoaderCircle, Plus, Users, ShieldCheck, LogOut } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";

type AddBusinessMode = "create" | "join";

export default function TopBar() {
  const router = useRouter();
  const { activeBusinessId, activeBusinessRole, businesses, setActiveBusiness, refreshBusinesses } = useBusiness();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addBusinessOpen, setAddBusinessOpen] = useState(false);
  const [addBusinessMode, setAddBusinessMode] = useState<AddBusinessMode>("create");
  const [businessName, setBusinessName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"error" | "success">("success");
  const containerRef = useRef<HTMLDivElement>(null);

  const activeBusinessName = activeBusinessId
    ? businesses.find((business) => business.id === activeBusinessId)?.name ?? "Selected business"
    : "No business selected";
  const activeBusinessLabel = activeBusinessRole === "owner" ? "Owner" : activeBusinessRole === "staff" ? "Staff" : "Member";

  useEffect(() => {
    if (!sheetOpen && !menuOpen && !addBusinessOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSheetOpen(false);
        setMenuOpen(false);
        setAddBusinessOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [sheetOpen, menuOpen, addBusinessOpen]);

  const handleCreateBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const supabase = createClient();
    if (!supabase) {
      setFeedback("Supabase is not configured yet.");
      setFeedbackTone("error");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.rpc("add_business", { business_name: businessName.trim() });
    if (error) {
      setFeedback(error.message);
      setFeedbackTone("error");
      setSubmitting(false);
      return;
    }

    setFeedback("Business created successfully.");
    setFeedbackTone("success");
    setBusinessName("");
    setAddBusinessOpen(false);
    setSheetOpen(false);
    await refreshBusinesses();
    setSubmitting(false);
  };

  const handleJoinBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const supabase = createClient();
    if (!supabase) {
      setFeedback("Supabase is not configured yet.");
      setFeedbackTone("error");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.rpc("redeem_invite_code", { code_input: inviteCode.trim().toUpperCase() });
    if (error) {
      setFeedback(error.message);
      setFeedbackTone("error");
      setSubmitting(false);
      return;
    }

    setFeedback("You joined the business.");
    setFeedbackTone("success");
    setInviteCode("");
    setAddBusinessOpen(false);
    setSheetOpen(false);
    await refreshBusinesses();
    setSubmitting(false);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setMenuOpen(false);
    router.push("/login");
  };

  return (
    <div ref={containerRef} className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-3 sm:px-4 lg:px-8">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--cream)]/70 px-3 py-2 text-left shadow-sm"
          onClick={() => setSheetOpen((value) => !value)}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--primary)] text-white">
            <Store className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[color:var(--ink)]">{activeBusinessName}</p>
            <p className="text-xs text-[color:var(--muted)]">{activeBusinessLabel}</p>
          </div>
          <ChevronDown className="ml-1 h-4 w-4 text-[color:var(--muted)]" />
        </button>

        <div className="flex items-center gap-2">
          <Link href="/dashboard/shops" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 text-[color:var(--ink)] shadow-sm transition hover:bg-[color:var(--cream)]">
            <Store className="h-4 w-4" />
          </Link>
          <Link href="/dashboard/products" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 text-[color:var(--ink)] shadow-sm transition hover:bg-[color:var(--cream)]">
            <Package className="h-4 w-4" />
          </Link>
          <div className="relative">
            <button
              type="button"
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-2.5 text-[color:var(--ink)] shadow-sm transition hover:bg-[color:var(--cream)]"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Open overflow menu"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-56 rounded-[1.25rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-2 shadow-[0_20px_60px_-30px_rgba(43,36,32,0.65)]">
                <Link href="/dashboard/product-delivery" className="flex items-center rounded-xl px-3 py-2 text-sm text-[color:var(--ink)] transition hover:bg-[color:var(--cream)]" onClick={() => setMenuOpen(false)}>
                  <Package className="mr-2 h-4 w-4" />
                  Product Delivery
                </Link>
                <Link href="/dashboard/payments" className="flex items-center rounded-xl px-3 py-2 text-sm text-[color:var(--ink)] transition hover:bg-[color:var(--cream)]" onClick={() => setMenuOpen(false)}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Payments
                </Link>
                <div className="my-2 h-px bg-[color:var(--border)]" />
                <Link href="/dashboard/members" className="flex items-center rounded-xl px-3 py-2 text-sm text-[color:var(--ink)] transition hover:bg-[color:var(--cream)]" onClick={() => setMenuOpen(false)}>
                  <Users className="mr-2 h-4 w-4" />
                  Members
                </Link>
                <Link href="/dashboard/settings" className="flex items-center rounded-xl px-3 py-2 text-sm text-[color:var(--ink)] transition hover:bg-[color:var(--cream)]" onClick={() => setMenuOpen(false)}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Settings
                </Link>
                <Link href="/dashboard/profile" className="flex items-center rounded-xl px-3 py-2 text-sm text-[color:var(--ink)] transition hover:bg-[color:var(--cream)]" onClick={() => setMenuOpen(false)}>
                  <Users className="mr-2 h-4 w-4" />
                  Profile
                </Link>
                <div className="my-2 h-px bg-[color:var(--border)]" />
                <button type="button" className="flex w-full items-center rounded-xl px-3 py-2 text-sm font-semibold text-[color:var(--danger)] transition hover:bg-[color:var(--danger-soft)]" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {sheetOpen ? (
        <div className="absolute inset-x-0 top-full z-50 border-t border-[color:var(--border)] bg-[color:var(--surface)]/95 px-3 py-3 shadow-[0_20px_50px_-25px_rgba(43,36,32,0.55)] backdrop-blur sm:px-4 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[color:var(--ink)]">Switch business</p>
              <button type="button" className="text-sm text-[color:var(--muted)]" onClick={() => setSheetOpen(false)}>
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {businesses.map((business) => (
                <button
                  key={business.id}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left ${business.id === activeBusinessId ? "border-[color:var(--primary)] bg-[color:var(--accent-soft)]" : "border-[color:var(--border)] bg-[color:var(--surface)]"}`}
                  onClick={() => {
                    setActiveBusiness(business.id);
                    setSheetOpen(false);
                  }}
                >
                  <span>
                    <span className="block text-sm font-semibold text-[color:var(--ink)]">{business.name}</span>
                    <span className="text-xs text-[color:var(--muted)]">{business.role === "owner" ? "Owner" : business.role === "staff" ? "Staff" : "Member"}</span>
                  </span>
                  {business.id === activeBusinessId ? <span className="text-sm font-semibold text-[color:var(--primary)]">Active</span> : null}
                </button>
              ))}
            </div>
            <button type="button" className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--cream)]/70 px-3 py-3 text-sm font-semibold text-[color:var(--ink)]" onClick={() => {
              setAddBusinessOpen(true);
              setSheetOpen(false);
            }}>
              <Plus className="h-4 w-4" />
              Add another business
            </button>
          </div>
        </div>
      ) : null}

      <Modal open={addBusinessOpen} onClose={() => setAddBusinessOpen(false)} title="Add another business" description="Create a workspace or join one with a code.">
        <div className="flex gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--cream)]/70 p-1">
          <button type="button" className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${addBusinessMode === "create" ? "bg-[color:var(--primary)] text-white" : "text-[color:var(--ink)]"}`} onClick={() => setAddBusinessMode("create")}>Create a business</button>
          <button type="button" className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${addBusinessMode === "join" ? "bg-[color:var(--primary)] text-white" : "text-[color:var(--ink)]"}`} onClick={() => setAddBusinessMode("join")}>Join with a code</button>
        </div>

        {addBusinessMode === "create" ? (
          <form className="mt-4 space-y-4" onSubmit={handleCreateBusiness}>
            <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} required placeholder="Acme Distribution" className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--primary)]" />
            {feedback && feedbackTone === "error" ? <p className="text-sm text-[color:var(--danger)]">{feedback}</p> : null}
            {feedback && feedbackTone === "success" ? <p className="text-sm text-[color:var(--success)]">{feedback}</p> : null}
            <Button type="submit" disabled={submitting} className="w-full" icon={submitting ? LoaderCircle : Plus}>
              {submitting ? "Creating..." : "Create business"}
            </Button>
          </form>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleJoinBusiness}>
            <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} required maxLength={8} placeholder="ABC12345" className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 text-sm uppercase outline-none focus:border-[color:var(--primary)]" />
            {feedback && feedbackTone === "error" ? <p className="text-sm text-[color:var(--danger)]">{feedback}</p> : null}
            {feedback && feedbackTone === "success" ? <p className="text-sm text-[color:var(--success)]">{feedback}</p> : null}
            <Button type="submit" variant="outline" disabled={submitting} className="w-full" icon={submitting ? LoaderCircle : Copy}>
              {submitting ? "Joining..." : "Join business"}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
