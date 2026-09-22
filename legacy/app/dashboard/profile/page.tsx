"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, LoaderCircle, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PasswordInput from "@/components/ui/PasswordInput";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [soleOwnerBlocked, setSoleOwnerBlocked] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setEmail(user?.email ?? null);
      setLoading(false);
    };

    void loadUser();
  }, []);

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setPasswordError("Supabase is not configured yet.");
      return;
    }

    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPasswordError(error.message);
      setPasswordLoading(false);
      return;
    }

    setPasswordSuccess("Password updated successfully.");
    setPassword("");
    setConfirmPassword("");
    setPasswordLoading(false);
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    setSoleOwnerBlocked(null);

    if (deleteConfirm.trim() !== "DELETE") {
      setDeleteError('Type DELETE (all caps) to confirm.');
      return;
    }

    setDeleteLoading(true);

    let response: Response;
    try {
      response = await fetch("/api/account/delete", { method: "POST" });
    } catch {
      setDeleteError("Could not reach the server. Please try again.");
      setDeleteLoading(false);
      return;
    }

    let payload: { deleted?: boolean; error?: string } = {};
    try {
      payload = await response.json();
    } catch {
      // Handled by the status checks below.
    }

    if (response.ok && payload.deleted) {
      const supabase = createClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
      router.push("/login?message=" + encodeURIComponent("Your account has been permanently deleted."));
      return;
    }

    if (response.status === 409 && payload.error) {
      setSoleOwnerBlocked(payload.error);
      setDeleteLoading(false);
      return;
    }

    setDeleteError(payload.error ?? "Something went wrong. Your account was not deleted.");
    setDeleteLoading(false);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/login");
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Account</p>
        <h1 className="text-2xl font-semibold text-[color:var(--ink)]">Profile</h1>
      </div>

      <Card className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">Email</p>
          {loading ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-[color:var(--muted)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading profile...
            </div>
          ) : (
            <p className="mt-2 text-sm text-[color:var(--muted)]">{email ?? "No email available"}</p>
          )}
        </div>

        <form className="space-y-4" onSubmit={handlePasswordChange}>
          <div className="rounded-[1.2rem] border border-[color:var(--border)] bg-[color:var(--cream)]/70 p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-[color:var(--primary)]" />
              <div>
                <p className="font-semibold text-[color:var(--ink)]">Change password</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">Use a strong password that you have not used before.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <PasswordInput id="new-password" label="New password" value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" minLength={8} />
              <PasswordInput id="confirm-password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter password" autoComplete="new-password" minLength={8} />
            </div>
          </div>
          {passwordError ? (
            <div className="flex items-center gap-2 text-sm text-[color:var(--danger)]">
              <AlertCircle className="h-4 w-4" />
              {passwordError}
            </div>
          ) : null}
          {passwordSuccess ? <p className="text-sm text-[color:var(--success)]">{passwordSuccess}</p> : null}
          <Button type="submit" disabled={passwordLoading} icon={passwordLoading ? LoaderCircle : ShieldCheck}>
            {passwordLoading ? "Updating..." : "Update password"}
          </Button>
        </form>

        <div className="border-t border-[color:var(--border)] pt-4">
          <Button variant="danger" onClick={handleLogout} icon={LogOut}>
            Log out
          </Button>
        </div>

        <div className="border-t border-[color:var(--border)] pt-4">
          <div className="rounded-[1.2rem] border-2 border-[color:var(--danger)] bg-[color:var(--danger)]/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-[color:var(--danger)]" />
              <div>
                <p className="font-semibold text-[color:var(--danger)]">Delete account</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  This permanently removes your account, your membership in any businesses, and your access
                  to this app. This cannot be undone. Historical business records you do not solely own are
                  not affected.
                </p>
              </div>
            </div>

            {soleOwnerBlocked ? (
              <div className="mt-4 rounded-[1rem] border border-[color:var(--danger)] bg-white p-3">
                <p className="text-sm text-[color:var(--danger)]">{soleOwnerBlocked}</p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  Resolve this first in the Distro mobile app: Account tab &rarr; Delete account, which has
                  the tools to transfer ownership or delete a business. Then return here to delete your account.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="delete-confirm"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Type <span className="font-semibold">DELETE</span> to confirm
                  </label>
                  <input
                    id="delete-confirm"
                    type="text"
                    value={deleteConfirm}
                    onChange={(event) => setDeleteConfirm(event.target.value)}
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--danger)]"
                  />
                </div>
                {deleteError ? (
                  <div className="flex items-center gap-2 text-sm text-[color:var(--danger)]">
                    <AlertCircle className="h-4 w-4" />
                    {deleteError}
                  </div>
                ) : null}
                <Button
                  variant="danger"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || deleteConfirm.trim() !== "DELETE"}
                  icon={deleteLoading ? LoaderCircle : Trash2}
                >
                  {deleteLoading ? "Deleting..." : "Permanently delete my account"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
