'use client';

import { FullScreenLoader, Redirect } from '@/components/redirect';
import { useBusinessAuth } from '@/lib/business-auth-context';

export default function BusinessOnboardingLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, membershipsLoading, memberships } = useBusinessAuth();

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!membershipsLoading && memberships.length > 0) return <Redirect href="/operations" />;
  return <>{children}</>;
}
