"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
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
      </Card>
    </div>
  );
}
