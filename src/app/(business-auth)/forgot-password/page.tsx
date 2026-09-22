'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { CenteredPage, PageTitle } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { requestPasswordReset } = useBusinessAuth();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      await requestPasswordReset(trimmedEmail);
      router.push(`/verify-otp?email=${encodeURIComponent(trimmedEmail)}&purpose=recovery`);
    } catch (err) {
      setError(getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CenteredPage>
      <div>
        <PageTitle>Reset password</PageTitle>
        <p className="mt-1 text-muted">We&apos;ll email you a 6-digit code to reset your password.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <FormInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>

        {error ? <MessageBox tone="danger" message={error} /> : null}

        <PrimaryButton type="submit" label="Send reset code" disabled={!canSubmit} loading={isSubmitting} />
      </form>

      <Link href="/login" className="text-center text-sm font-medium text-primary">
        Back to log in
      </Link>
    </CenteredPage>
  );
}
