'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { CenteredPage, PageTitle } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { useToast } from '@/components/toast';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';

function VerifyOtp() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email');
  const purpose = params.get('purpose') as 'signup' | 'recovery' | null;
  const { verifySignupOtp, verifyRecoveryOtp, updatePassword } = useBusinessAuth();
  const toast = useToast();

  const [phase, setPhase] = useState<'code' | 'password'>('code');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email || !purpose) {
    return (
      <CenteredPage>
        <p className="text-center text-danger">Missing verification details. Go back and try again.</p>
      </CenteredPage>
    );
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault();
    if (!email || code.trim().length === 0 || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      if (purpose === 'signup') {
        await verifySignupOtp(email, code.trim());
        router.replace('/operations');
      } else {
        await verifyRecoveryOtp(email, code.trim());
        setPhase('password');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'That code is invalid or expired.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmitPassword = newPassword.length >= 6 && newPassword === confirmPassword;

  async function handleSetNewPassword(event: FormEvent) {
    event.preventDefault();
    if (!canSubmitPassword || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await updatePassword(newPassword);
      toast.show('Password updated');
      router.replace('/operations');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update your password.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <CenteredPage>
      {phase === 'code' ? (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <PageTitle>Enter the code</PageTitle>
            <p className="mt-1 text-muted">We sent a 6-digit code to {email}.</p>
          </div>
          <FormInput
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="123456"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
          />
          {error ? <MessageBox tone="danger" message={error} /> : null}
          <PrimaryButton type="submit" label="Verify" disabled={code.trim().length === 0} loading={isSubmitting} />
        </form>
      ) : (
        <form onSubmit={handleSetNewPassword} className="space-y-4">
          <div>
            <PageTitle>Set a new password</PageTitle>
            <p className="mt-1 text-muted">Choose a new password for {email}.</p>
          </div>
          <Field label="New password">
            <FormInput
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
                newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword
                  ? "Passwords don't match."
                  : null
              }
            />
          </Field>
          {error ? <MessageBox tone="danger" message={error} /> : null}
          <PrimaryButton
            type="submit"
            label="Set new password"
            disabled={!canSubmitPassword}
            loading={isSubmitting}
          />
        </form>
      )}
    </CenteredPage>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtp />
    </Suspense>
  );
}
