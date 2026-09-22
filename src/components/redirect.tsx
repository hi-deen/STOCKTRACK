'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Client-side equivalent of expo-router's <Redirect>.
export function Redirect({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(href);
  }, [router, href]);
  return null;
}

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
