'use client';

import { FullScreenLoader, Redirect } from '@/components/redirect';
import { useBusinessAuth } from '@/lib/business-auth-context';

export default function BusinessAuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useBusinessAuth();

  if (isLoading) return <FullScreenLoader />;
  if (isAuthenticated) return <Redirect href="/operations" />;
  return <>{children}</>;
}
