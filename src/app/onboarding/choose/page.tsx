'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { BrandMark } from '@/components/brand-mark';
import { CenteredPage, PageTitle } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { useBusinessAuth } from '@/lib/business-auth-context';

export default function OnboardingChoosePage() {
  const router = useRouter();
  const { signOut } = useBusinessAuth();

  return (
    <CenteredPage>
      <BrandMark />
      <div>
        <PageTitle>Let&apos;s get you set up</PageTitle>
        <p className="mt-1 text-muted">Create a new business, or join one you&apos;ve been invited to.</p>
      </div>

      <PrimaryButton label="Create a new business" onClick={() => router.push('/onboarding/create')} />
      <PrimaryButton label="Join with an invite code" variant="outline" onClick={() => router.push('/onboarding/join')} />

      <Link
        href="/"
        onClick={async (event) => {
          event.preventDefault();
          await signOut();
          router.replace('/');
        }}
        className="text-center text-sm font-medium text-primary">
        Log out
      </Link>
    </CenteredPage>
  );
}
