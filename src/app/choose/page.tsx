'use client';

import Link from 'next/link';

import { BrandMark } from '@/components/brand-mark';
import { CenteredPage } from '@/components/page';

const BUTTON_BASE =
  'flex min-h-[48px] w-full items-center justify-center rounded-md px-4 py-3 text-center text-base font-bold transition active:scale-[0.98]';

export default function ChoosePage() {
  return (
    <CenteredPage>
      <div className="flex justify-center">
        <BrandMark />
      </div>
      <p className="mb-2 text-center text-muted">Choose how you&apos;d like to continue.</p>
      <Link href="/rider/login" className={`${BUTTON_BASE} bg-primary text-on-primary hover:opacity-90`}>
        Continue as rider
      </Link>
      <Link
        href="/login"
        className={`${BUTTON_BASE} border border-primary text-primary hover:bg-primary-soft`}>
        Continue as business owner or staff
      </Link>
      <p className="mt-2 text-center text-sm text-muted">
        Want to delete your account?{' '}
        <Link href="/delete-account" className="font-medium text-primary">
          Learn how
        </Link>
      </p>
    </CenteredPage>
  );
}
