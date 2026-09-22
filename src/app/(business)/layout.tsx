'use client';

import { AppShell } from '@/components/app-shell';
import { MessageBox } from '@/components/message-box';
import { PrimaryButton } from '@/components/primary-button';
import { FullScreenLoader, Redirect } from '@/components/redirect';
import { useBusinessAuth } from '@/lib/business-auth-context';

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, membershipsLoading, membershipsError, memberships, refetchMemberships } =
    useBusinessAuth();

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (membershipsLoading && memberships.length === 0) return <FullScreenLoader />;

  if (membershipsError && memberships.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <MessageBox tone="danger" message={membershipsError} />
        <PrimaryButton label="Try again" onClick={refetchMemberships} />
      </main>
    );
  }

  if (memberships.length === 0) return <Redirect href="/onboarding/choose" />;

  return <AppShell>{children}</AppShell>;
}
