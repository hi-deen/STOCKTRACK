"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Plus, Search, Store, Truck, Users, X } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { createClient } from "@/lib/supabase/client";
import { useSignedPhotoUrl } from "@/lib/supabase/photo";

type RiderRow = {
  id: string;
  rider_id: string;
  business_id: string;
  status: string;
  requested_via: string;
  invited_by: string | null;
  created_at: string;
  responded_at: string | null;
  rider_phone: string;
  rider_full_name: string;
  rider_photo_path: string | null;
  rider_is_active: boolean;
};

type RiderAssignment = {
  id: string;
  rider_business_link_id: string;
  shop_id: string;
  days_of_week: number[];
  notes: string | null;
  created_at: string;
};

type ShopOption = {
  id: string;
  name: string;
  area: string | null;
};

const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function DispatchPage() {
  const { activeBusinessId, loading: businessLoading } = useBusiness();
  const [rows, setRows] = useState<RiderRow[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"invite" | "code">("invite");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedRider, setSelectedRider] = useState<RiderRow | null>(null);
  const [assignments, setAssignments] = useState<Record<string, number[]>>({});
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setRows([]);
      setShops([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [ridersRes, shopsRes] = await Promise.all([
      supabase.rpc("get_business_riders", { business_id_input: activeBusinessId }),
      supabase.from("shops").select("id,name,area").eq("business_id", activeBusinessId).order("name"),
    ]);

    if (ridersRes.error || shopsRes.error) {
      setError((ridersRes.error ?? shopsRes.error)?.message ?? "Unable to load dispatch data.");
      setLoading(false);
      return;
    }

    setRows((ridersRes.data ?? []) as RiderRow[]);
    setShops((shopsRes.data ?? []) as ShopOption[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [activeBusinessId]);

  const groupedRows = useMemo(() => {
    const groups = {
      active: rows.filter((row) => row.status === "active"),
      pending: rows.filter((row) => row.status === "pending"),
      declined: rows.filter((row) => row.status === "declined"),
      removed: rows.filter((row) => row.status === "removed"),
    };
    return groups;
  }, [rows]);

  const handleInviteByPhone = async () => {
    const phoneValue = phone.trim();
    const supabase = createClient();
    if (!supabase || !activeBusinessId || !phoneValue) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data: rider, error: riderError } = await supabase.from("riders").select("id, phone, full_name").eq("phone", phoneValue).maybeSingle();
    if (riderError) {
      setError(riderError.message);
      setSubmitting(false);
      return;
    }

    if (!rider) {
      setError("No rider found with this number - they need to sign up first.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("rider_business_links").insert({
      rider_id: rider.id,
      business_id: activeBusinessId,
      status: "pending",
      invited_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      requested_via: "owner_invite",
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setPhone("");
    setModalOpen(false);
    await loadData();
    setSubmitting(false);
  };

  const handleGenerateCode = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase.rpc("generate_rider_invite_code", { business_id_input: activeBusinessId });
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setInviteCode(data as string);
    setSubmitting(false);
  };

  const handleCopy = async () => {
    if (!inviteCode) {
      return;
    }
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openRiderDetails = async (rider: RiderRow) => {
    setSelectedRider(rider);
    const supabase = createClient();
    if (!supabase) {
      return;
    }

    const { data } = await supabase.from("rider_assignments").select("*").eq("rider_business_link_id", rider.id);
    const nextAssignments: Record<string, number[]> = {};
    (data ?? []).forEach((assignment: RiderAssignment) => {
      nextAssignments[assignment.shop_id] = assignment.days_of_week ?? [];
    });
    setAssignments(nextAssignments);
  };

  const toggleDay = async (shopId: string, dayIndex: number) => {
    if (!selectedRider) {
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      return;
    }

    const nextDays = assignments[shopId] ?? [];
    const hasDay = nextDays.includes(dayIndex);
    const updatedDays = hasDay ? nextDays.filter((day) => day !== dayIndex) : [...nextDays, dayIndex].sort((a, b) => a - b);

    setAssignmentLoading(true);
    const { error } = await supabase.rpc("update_rider_assignment", {
      rider_business_link_id_input: selectedRider.id,
      shop_id_input: shopId,
      days_of_week_input: updatedDays,
    });

    if (!error) {
      setAssignments((current) => ({
        ...current,
        [shopId]: updatedDays,
      }));
    }

    setAssignmentLoading(false);
  };

  const removeFromBusiness = async () => {
    if (!selectedRider) {
      return;
    }
    const confirmed = window.confirm(`Remove ${selectedRider.rider_full_name} from this business?`);
    if (!confirmed) {
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      return;
    }

    const { error } = await supabase.from("rider_business_links").update({
      status: "removed",
      responded_at: new Date().toISOString(),
    }).eq("id", selectedRider.id);

    if (!error) {
      setSelectedRider(null);
      await loadData();
    } else {
      setError(error.message);
    }
  };

  if (businessLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Dispatch</p>
          <h1 className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">Dispatch Riders</h1>
        </div>
        <Button onClick={() => setModalOpen(true)} icon={Plus}>Add Rider</Button>
      </Card>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="space-y-3">
        {groupedRows.active.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-[color:var(--ink)]">Active</p>
            <div className="space-y-2">
              {groupedRows.active.map((item) => (
                <button key={item.id} type="button" onClick={() => void openRiderDetails(item)} className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-left">
                  <div className="flex items-center gap-3">
                    <RiderAvatar photoPath={item.rider_photo_path} name={item.rider_full_name} />
                    <div>
                      <p className="font-semibold text-[color:var(--ink)]">{item.rider_full_name}</p>
                      <p className="text-sm text-[color:var(--muted)]">{item.rider_phone}</p>
                    </div>
                    <Badge variant="success" className="ml-auto">Active</Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {groupedRows.pending.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-[color:var(--ink)]">Pending</p>
            <div className="space-y-2">
              {groupedRows.pending.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                  <div className="flex items-center gap-3">
                    <RiderAvatar photoPath={item.rider_photo_path} name={item.rider_full_name} />
                    <div>
                      <p className="font-semibold text-[color:var(--ink)]">{item.rider_full_name}</p>
                      <p className="text-sm text-[color:var(--muted)]">{item.rider_phone}</p>
                    </div>
                    <Badge variant="warning" className="ml-auto">Pending</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {groupedRows.declined.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-[color:var(--ink)]">Declined</p>
            <div className="space-y-2">
              {groupedRows.declined.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                  <div className="flex items-center gap-3">
                    <RiderAvatar photoPath={item.rider_photo_path} name={item.rider_full_name} />
                    <div>
                      <p className="font-semibold text-[color:var(--ink)]">{item.rider_full_name}</p>
                      <p className="text-sm text-[color:var(--muted)]">{item.rider_phone}</p>
                    </div>
                    <Badge variant="danger">Declined</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {rows.length === 0 ? (
          <EmptyState icon={Truck} title="No riders yet" description="Invite your first rider to start planning delivery routes." actionLabel="Add rider" onAction={() => setModalOpen(true)} />
        ) : null}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-3 sm:px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Add Rider</h3>
              <button type="button" onClick={() => setModalOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4">
              <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                <button type="button" onClick={() => setMode("invite")} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${mode === "invite" ? "bg-[color:var(--primary)] text-white" : "text-slate-700"}`}>Invite by phone</button>
                <button type="button" onClick={() => setMode("code")} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${mode === "code" ? "bg-[color:var(--primary)] text-white" : "text-slate-700"}`}>Generate invite code</button>
              </div>
              {mode === "invite" ? (
                <div className="mt-4 space-y-3">
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone number" className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm" />
                  <Button onClick={() => void handleInviteByPhone()} disabled={submitting} className="w-full">{submitting ? "Saving..." : "Invite rider"}</Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <Button onClick={() => void handleGenerateCode()} disabled={submitting} className="w-full">{submitting ? "Generating..." : "Generate code"}</Button>
                  {inviteCode ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-lg font-semibold text-slate-900">{inviteCode}</span>
                        <button type="button" onClick={() => void handleCopy()} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm">{copied ? "Copied" : "Copy"}</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedRider ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-3 py-3 sm:px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div className="flex items-center gap-3">
                <RiderAvatar photoPath={selectedRider.rider_photo_path} name={selectedRider.rider_full_name} />
                <div>
                  <h3 className="font-semibold text-slate-900">{selectedRider.rider_full_name}</h3>
                  <p className="text-sm text-slate-500">{selectedRider.rider_phone}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedRider(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">Assigned Shops</p>
                <div className="space-y-3">
                  {shops.map((shop) => {
                    const selectedDays = assignments[shop.id] ?? [];
                    return (
                      <div key={shop.id} className="rounded-2xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-800">{shop.name}</p>
                            <p className="text-xs text-slate-500">{shop.area ?? "Unassigned area"}</p>
                          </div>
                          <button type="button" onClick={() => void toggleDay(shop.id, 0)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${selectedDays.length > 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                            {selectedDays.length > 0 ? "Assigned" : "Assign"}
                          </button>
                        </div>
                        {selectedDays.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {dayLabels.map((label, index) => (
                              <button type="button" key={label} onClick={() => void toggleDay(shop.id, index)} className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${selectedDays.includes(index) ? "bg-[color:var(--primary)] text-white" : "bg-slate-100 text-slate-700"}`}>
                                {label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="danger" onClick={() => void removeFromBusiness()}>Remove from business</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RiderAvatar({ photoPath, name }: { photoPath: string | null; name: string }) {
  const signedPhotoUrl = useSignedPhotoUrl(photoPath);
  if (signedPhotoUrl) {
    return <img src={signedPhotoUrl} alt={name} className="h-11 w-11 rounded-full object-cover" />;
  }
  return <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--cream)] text-sm font-semibold text-[color:var(--ink)]">{name.slice(0, 1)}</div>;
}
