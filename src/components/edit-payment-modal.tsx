'use client';

import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { Field, FormInput, FormTextarea } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { PrimaryButton } from '@/components/primary-button';

interface EditPaymentModalProps {
  visible: boolean;
  initialAmount: number;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (amount: number, reason: string) => void;
}

export function EditPaymentModal({ visible, initialAmount, loading, error, onCancel, onSubmit }: EditPaymentModalProps) {
  const [amount, setAmount] = useState(String(initialAmount));
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (visible) {
      setAmount(String(initialAmount));
      setReason('');
    }
  }, [visible, initialAmount]);

  const amountNumber = Number(amount);
  const canSubmit = Number.isFinite(amountNumber) && amountNumber > 0 && reason.trim().length > 0;

  return (
    <BottomSheet visible={visible} onClose={onCancel} title="Edit payment">
      <div className="space-y-4 pb-2">
        <Field label="Amount">
          <FormInput value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" />
        </Field>
        <Field label="Reason for edit">
          <FormTextarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What changed and why" />
        </Field>
        {error ? <MessageBox tone="danger" message={error} /> : null}
        <div className="flex items-center justify-end gap-4">
          <button type="button" onClick={onCancel} className="px-2 py-2 text-muted">
            Cancel
          </button>
          <div className="min-w-[130px]">
            <PrimaryButton
              label="Save changes"
              onClick={() => onSubmit(amountNumber, reason.trim())}
              disabled={!canSubmit}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
