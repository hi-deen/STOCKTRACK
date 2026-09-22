'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { CenteredPage, PageTitle } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { getErrorMessage } from '@/lib/error-message';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { useBusinessAuth } from '@/lib/business-auth-context';

export default function BusinessLoginPage() {
  const router = useRouter();
  const { signIn } = useBusinessAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
      hapticSuccess();
      router.replace('/operations');
    } catch (err) {
      hapticError();
      setError(getErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CenteredPage>
      <BrandMark />
      <div>
        <PageTitle>Business login</PageTitle>
        <p className="mt-1 text-muted">Log in with your email and password.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email">
          <FormInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
          />
        </Field>
        <Field label="Password">
          <FormInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>

        {error ? <MessageBox tone="danger" message={error} /> : null}

        <PrimaryButton type="submit" label="Log in" disabled={!canSubmit} loading={isSubmitting} />
      </form>

      <div className="space-y-2 text-center text-sm">
        <Link href="/forgot-password" className="block font-medium text-primary">
          Forgot password?
        </Link>
        <Link href="/signup" className="block text-muted">
          New business? <span className="font-medium text-primary">Sign up</span>
        </Link>
        <Link href="/choose" className="block text-muted">
          Are you a rider? <span className="font-medium text-primary">Rider login</span>
        </Link>
      </div>
    </CenteredPage>
  );
}
