import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete your account — Distro",
  description: "Request deletion of your Distro / StockTrack account and data. Choose your account type to continue.",
};

const BUTTON =
  "mt-3 inline-flex rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition hover:opacity-90";

export default function DeleteAccountPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-primary">Distro</p>
          <h1 className="mt-2 text-[26px] font-bold leading-8 text-fg">Delete your account</h1>
          <p className="mt-2 text-sm text-muted">
            Distro / StockTrack has two separate account types. Choose the one that describes you to continue to the
            right deletion page.
          </p>
        </div>

        <section className="space-y-4 rounded-lg border border-line bg-surface p-6">
          <div>
            <h2 className="text-base font-bold text-fg">I&apos;m a business owner or staff member</h2>
            <p className="mt-1 text-sm text-muted">
              You sign in with an email address and password. Delete your account from Account → Delete account (you&apos;ll
              need to log in first).
            </p>
            <Link href="/account/delete-account" className={BUTTON}>
              Go to delete account
            </Link>
          </div>

          <div className="border-t border-line pt-4">
            <h2 className="text-base font-bold text-fg">I&apos;m a rider</h2>
            <p className="mt-1 text-sm text-muted">
              You sign in with a phone number and PIN in the Distro app. Delete your account from the rider deletion page —
              no login required to read the instructions.
            </p>
            <Link href="/rider/delete-account" className={BUTTON}>
              Go to rider account deletion
            </Link>
          </div>
        </section>

        <p className="text-center text-sm text-muted">
          Not sure which one you are? If you log in with an email address, you&apos;re an owner/staff member. If you log in
          with a phone number and PIN, you&apos;re a rider.
        </p>
      </div>
    </div>
  );
}
