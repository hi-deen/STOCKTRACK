'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { FormInput, FormTextarea } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { isNetworkError, queueMutation } from '@/lib/offline/db';
import { recordPayment } from '@/lib/operations-api';

function RecordPayment() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, userId } = useBusinessAuth();
  const { shopId } = useParams<{ shopId: string }>();
  const shopName = useSearchParams().get('shopName');

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const amountNumber = Number(amount);
  const canSubmit =
    !!activeBusinessId && !!shopId && Number.isFinite(amountNumber) && amountNumber > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !activeBusinessId || !shopId) return;
    setSubmitting(true);
    setSubmitError(null);
    const input = {
      businessId: activeBusinessId,
      shopId,
      amount: amountNumber,
      method: method.trim() || null,
      notes: notes.trim() || null,
      createdBy: userId,
    };
    try {
      await recordPayment(input);
      toast.show('Payment recorded');
      router.back();
    } catch (err) {
      if (isNetworkError(err)) {
        await queueMutation({
          business_id: activeBusinessId,
          type: 'payment',
          payload: input,
          shop_name: shopName ?? undefined,
        });
        toast.show("Saved offline — will sync when you're back online");
        router.back();
      } else {
        setSubmitError(getErrorMessage(err, 'Could not record this payment. Please try again.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Record payment" subtitle={shopName || undefined} back />
      <Page narrow>
        <SectionLabel>Amount</SectionLabel>
        <FormInput
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="e.g. 5000"
          inputMode="decimal"
        />

        <SectionLabel>Method</SectionLabel>
        <FormInput value={method} onChange={(e) => setMethod(e.target.value)} placeholder="e.g. cash, transfer" />

        <SectionLabel>Notes</SectionLabel>
        <FormTextarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />

        {submitError ? <MessageBox tone="danger" message={submitError} /> : null}

        <PrimaryButton label="Record payment" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
      </Page>
    </>
  );
}

export default function RecordPaymentPage() {
  return (
    <Suspense fallback={null}>
      <RecordPayment />
    </Suspense>
  );
}
