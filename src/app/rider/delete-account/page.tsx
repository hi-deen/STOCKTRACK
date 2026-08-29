import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delete your rider account — StockTrack",
  description: "How to request deletion of your StockTrack / Distro rider account and data.",
};

const SUPPORT_EMAIL = "support@codegreentechnologies.ng";

export default function RiderDeleteAccountPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--background)] px-4 py-12">
      <div className="w-full max-w-xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--primary)]">Dispatch</p>
          <h1 className="mt-2 text-3xl font-semibold text-[color:var(--ink)]">Delete your rider account</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            This page explains how to permanently delete your StockTrack / Distro rider account
            (the phone number + PIN login used in the Distro mobile app) and the data linked to it.
          </p>
        </div>

        <section className="space-y-4 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[0_18px_48px_-24px_rgba(43,36,32,0.45)]">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--ink)]">Option 1 — Delete it yourself</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              If you can still sign in, log in with your phone number and PIN, open the menu
              (top-right) on your home screen, and choose <span className="font-semibold">Delete account</span>.
              You will be asked to re-enter your PIN and confirm. Deletion is immediate.
            </p>
            <Link
              href="/rider/login"
              className="mt-3 inline-flex rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Go to rider login
            </Link>
          </div>

          <div className="border-t border-[color:var(--border)] pt-4">
            <h2 className="text-base font-semibold text-[color:var(--ink)]">Option 2 — Ask us to delete it</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              If you cannot sign in (forgotten PIN, deactivated account), email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[color:var(--ink)] underline">
                {SUPPORT_EMAIL}
              </a>{" "}
              from any address and include the phone number registered to your rider account. We will
              verify the request and delete the account within 30 days, then confirm by reply.
            </p>
          </div>
        </section>

        <section className="space-y-2 rounded-[1.5rem] border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <h2 className="text-base font-semibold text-[color:var(--ink)]">What is deleted</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--muted)]">
            <li>Your rider profile (name, phone number, PIN, profile photo)</li>
            <li>Your login sessions</li>
            <li>Your links to businesses and your route/shop assignments</li>
          </ul>
          <h2 className="mt-3 text-base font-semibold text-[color:var(--ink)]">What is kept</h2>
          <p className="text-sm text-[color:var(--muted)]">
            Delivery records that businesses recorded for their own bookkeeping are retained, but
            they are unlinked from you — your name and contact details are removed from them.
          </p>
        </section>

        <p className="text-center text-sm text-[color:var(--muted)]">
          Not a rider?{" "}
          <Link href="/dashboard/profile" className="font-semibold text-[color:var(--ink)]">
            Delete a business owner/member account
          </Link>
        </p>
      </div>
    </div>
  );
}
