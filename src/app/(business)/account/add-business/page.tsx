'use client';

import { useRouter } from 'next/navigation';

import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';

// Reachable from Account by anyone already signed in and already a member
// of at least one business — separate from /onboarding/*, which only
// exists to get a brand-new user (zero memberships) set up and redirects
// straight past itself once memberships.length > 0.
export default function AddBusinessPage() {
  const router = useRouter();

  return (
    <>
      <ScreenHeader title="Add a business" back />
      <Page narrow>
        <p className="text-muted">
          Create a new business, or join one you&apos;ve been invited to. You&apos;ll keep access to your
          other businesses too — switch between them from the Account tab.
        </p>

        <PrimaryButton label="Create a new business" onClick={() => router.push('/account/add-business/create')} />
        <PrimaryButton
          label="Join with an invite code"
          variant="outline"
          onClick={() => router.push('/account/add-business/join')}
        />
      </Page>
    </>
  );
}
