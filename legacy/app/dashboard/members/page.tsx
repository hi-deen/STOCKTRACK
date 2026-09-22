"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Copy, LoaderCircle, Sparkles, Users } from "lucide-react";
import { useBusiness } from "@/components/providers/business-provider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";

type MemberRow = {
  user_id: string;
  email: string | null;
  role: string;
  joined_at: string;
};

export default function MembersPage() {
  const { activeBusinessId, activeBusinessRole } = useBusiness();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    const loadMembers = async () => {
      const supabase = createClient();
      if (!supabase || !activeBusinessId) {
        setMembers([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      const { data, error } = await supabase.rpc("get_business_members", { business_id_input: activeBusinessId });

      if (error) {
        setError(error.message);
        setMembers([]);
        setLoading(false);
        return;
      }

      setMembers((data ?? []) as MemberRow[]);
      setLoading(false);
    };

    void loadMembers();
  }, [activeBusinessId]);

  const handleGenerateInvite = async () => {
    const supabase = createClient();
    if (!supabase || !activeBusinessId) {
      setInviteError("Unable to generate invite code right now.");
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    const { data, error } = await supabase.rpc("generate_invite_code", { business_id_input: activeBusinessId });
    if (error) {
      setInviteError(error.message);
      setInviteLoading(false);
      return;
    }

    setInviteCode(data as string);
    setInviteOpen(true);
    setInviteLoading(false);

    window.setTimeout(() => {
      setInviteOpen(false);
    }, 30000);
  };

  const copyInviteCode = async () => {
    if (!inviteCode) {
      return;
    }

    await navigator.clipboard.writeText(inviteCode);
    setInviteOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Team</p>
          <h1 className="text-2xl font-semibold text-[color:var(--ink)]">Members</h1>
        </div>
      </div>

      {activeBusinessRole === "owner" ? (
        <Card className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[color:var(--accent-soft)] p-2 text-[color:var(--accent)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-[color:var(--ink)]">Invite a team member</p>
            </div>
            <Button onClick={handleGenerateInvite} disabled={inviteLoading} icon={inviteLoading ? LoaderCircle : Sparkles} className="px-3 py-2 text-xs">
              {inviteLoading ? "Generating..." : "Generate Code"}
            </Button>
          </div>
          {inviteOpen && inviteCode ? (
            <div className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--cream)]/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold tracking-[0.24em] text-[color:var(--ink)]">{inviteCode}</span>
                <button type="button" onClick={copyInviteCode} className="rounded-full p-1.5 text-[color:var(--muted)] hover:bg-[color:var(--surface)]" aria-label="Copy invite code">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-xs text-[color:var(--muted)]">The code expires in 7 days.</p>
            </div>
          ) : null}
          {inviteError ? <p className="mt-2 text-sm text-[color:var(--danger)]">{inviteError}</p> : null}
        </Card>
      ) : null}

      <Card>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading members...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-[color:var(--danger)]">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
            <Users className="h-4 w-4" />
            No members found for this business yet.
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.user_id} className="flex flex-col gap-3 rounded-[1.2rem] border border-[color:var(--border)] bg-[color:var(--cream)]/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[color:var(--ink)]">{member.email ?? "Unknown user"}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                </div>
                <Badge variant={member.role === "owner" ? "success" : "neutral"}>
                  {member.role === "owner" ? "Owner" : "Staff"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
