'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { CenteredPage, PageTitle } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { getErrorMessage } from '@/lib/error-message';
import { useRiderAuth } from '@/lib/rider-auth-context';

function RiderLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, isAuthenticated } = useRiderAuth();

  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) router.replace('/rider/home');
  }, [isAuthenticated, router]);

  const canSubmit = phone.trim().length >= 7 && pin.length >= 4;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await login(phone.trim(), pin);
      router.replace('/rider/home');
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CenteredPage>
      <BrandMark />
      <div>
        <PageTitle>Rider login</PageTitle>
        <p className="mt-1 text-muted">Log in with your phone number and PIN.</p>
      </div>

      {params.get('deleted') === '1' ? (
        <MessageBox tone="success" message="Your account has been deleted." />
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Phone number">
          <FormInput
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 08012345678"
            autoComplete="tel"
          />
        </Field>
        <Field label="PIN">
          <FormInput
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="••••"
            maxLength={6}
            autoComplete="current-password"
          />
        </Field>

        {error ? <MessageBox tone="danger" message={error} /> : null}

        <PrimaryButton type="submit" label="Log in" disabled={!canSubmit} loading={isSubmitting} />
      </form>

      <div className="space-y-2 text-center text-sm">
        <Link href="/rider/signup" className="block text-muted">
          New rider? <span className="font-medium text-primary">Create an account</span>
        </Link>
        <Link href="/login" className="block text-muted">
          Business owner or staff? <span className="font-medium text-primary">Business login</span>
        </Link>
      </div>
    </CenteredPage>
  );
}

export default function RiderLoginPage() {
  return (
    <Suspense fallback={null}>
      <RiderLogin />
    </Suspense>
  );
}
