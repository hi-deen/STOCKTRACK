'use client';

import { FullScreenLoader, Redirect } from '@/components/redirect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { useRiderAuth } from '@/lib/rider-auth-context';

export default function Index() {
  const { isAuthenticated: riderAuthenticated, isLoading: riderLoading } = useRiderAuth();
  const { isAuthenticated: businessAuthenticated, isLoading: businessLoading } = useBusinessAuth();

  if (riderLoading || businessLoading) return <FullScreenLoader />;
  if (riderAuthenticated) return <Redirect href="/rider/home" />;
  if (businessAuthenticated) return <Redirect href="/operations" />;
  return <Redirect href="/choose" />;
}
