'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';

export default function AddBusinessJoinPage() {
  const router = useRouter();
  const { joinBusiness } = useBusinessAuth();
  const toast = useToast();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = code.trim().length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      // Also switches the active business to the new one — see the comment
      // on BusinessAuthProvider's joinBusiness.
      await joinBusiness(code.trim());
      toast.show('Joined business');
      router.replace('/operations');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not redeem that invite code.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Join a business" back />
      <Page narrow>
        <p className="text-muted">Enter the invite code the business owner shared with you.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Invite code">
            <FormInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. 4F9A2C1D"
              autoCapitalize="characters"
              autoCorrect="off"
            />
          </Field>

          {error ? <MessageBox tone="danger" message={error} /> : null}

          <PrimaryButton type="submit" label="Join business" disabled={!canSubmit} loading={isSubmitting} />
        </form>
      </Page>
    </>
  );
}
