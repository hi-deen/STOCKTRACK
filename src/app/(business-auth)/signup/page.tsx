'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { CenteredPage, PageTitle } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';

export default function BusinessSignupPage() {
  const router = useRouter();
  const { signUp } = useBusinessAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && password === confirmPassword;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      const { needsVerification } = await signUp(trimmedEmail, password);
      if (needsVerification) {
        router.push(`/verify-otp?email=${encodeURIComponent(trimmedEmail)}&purpose=signup`);
      } else {
        router.replace('/operations');
      }
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
        <PageTitle>Create business account</PageTitle>
        <p className="mt-1 text-muted">Sign up with your email — you&apos;ll create or join a business next.</p>
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
        <Field label="Password (min. 6 characters)">
          <FormInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm password">
          <FormInput
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            error={
              password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword
                ? "Passwords don't match."
                : null
            }
          />
        </Field>

        {error ? <MessageBox tone="danger" message={error} /> : null}

        <PrimaryButton type="submit" label="Sign up" disabled={!canSubmit} loading={isSubmitting} />
      </form>

      <Link href="/login" className="text-center text-sm text-muted">
        Already have an account? <span className="font-medium text-primary">Log in</span>
      </Link>
    </CenteredPage>
  );
}
