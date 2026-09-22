'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { CenteredPage, PageTitle } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { getErrorMessage } from '@/lib/error-message';
import { useRiderAuth } from '@/lib/rider-auth-context';

export default function RiderSignupPage() {
  const router = useRouter();
  const { signup } = useRiderAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    fullName.trim().length > 0 && phone.trim().length >= 7 && /^\d{4,6}$/.test(pin) && pin === confirmPin;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await signup(phone.trim(), pin, fullName.trim());
      router.replace('/rider/home');
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CenteredPage>
      <div>
        <PageTitle>Create rider account</PageTitle>
        <p className="mt-1 text-muted">Sign up with your phone number and a PIN you&apos;ll use to log in.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Full name">
          <FormInput
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Musa Ibrahim"
            autoComplete="name"
          />
        </Field>
        <Field label="Phone number">
          <FormInput
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 08012345678"
            autoComplete="tel"
          />
        </Field>
        <Field label="PIN (4–6 digits)">
          <FormInput
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="••••"
            maxLength={6}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm PIN">
          <FormInput
            type="password"
            inputMode="numeric"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="••••"
            maxLength={6}
            autoComplete="new-password"
            error={pin.length > 0 && confirmPin.length > 0 && pin !== confirmPin ? "PINs don't match." : null}
          />
        </Field>

        {error ? <MessageBox tone="danger" message={error} /> : null}

        <PrimaryButton type="submit" label="Sign up" disabled={!canSubmit} loading={isSubmitting} />
      </form>

      <Link href="/rider/login" className="text-center text-sm text-muted">
        Already have an account? <span className="font-medium text-primary">Log in</span>
      </Link>
    </CenteredPage>
  );
}
