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

export default function AddBusinessCreatePage() {
  const router = useRouter();
  const { createBusiness } = useBusinessAuth();
  const toast = useToast();

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      // Also switches the active business to the new one — see the comment
      // on BusinessAuthProvider's createBusiness.
      await createBusiness(name.trim());
      toast.show('Business created');
      router.replace('/operations');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your business.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="New business" back />
      <Page narrow>
        <p className="text-muted">You&apos;ll be the owner of this business.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Business name">
            <FormInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Distribution" />
          </Field>

          {error ? <MessageBox tone="danger" message={error} /> : null}

          <PrimaryButton type="submit" label="Create business" disabled={!canSubmit} loading={isSubmitting} />
        </form>
      </Page>
    </>
  );
}
