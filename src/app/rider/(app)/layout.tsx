'use client';

import { FullScreenLoader, Redirect } from '@/components/redirect';
import { useRiderAuth } from '@/lib/rider-auth-context';

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useRiderAuth();

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Redirect href="/rider/login" />;
  return <div className="min-h-screen bg-app">{children}</div>;
}
