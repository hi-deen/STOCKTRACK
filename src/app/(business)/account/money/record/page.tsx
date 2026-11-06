'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ChipRow } from '@/components/chip-row';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatMoney, toDateString } from '@/lib/format';
import {
  MOVEMENT_KINDS,
  getMoneyPosition,
  recordMoneyMovement,
  type MoneyPosition,
  type MovementKind,
} from '@/lib/money-api';

export default function RecordMoneyPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, userId } = useBusinessAuth();

  const [position, setPosition] = useState<MoneyPosition | null>(null);
  const [kind, setKind] = useState<MovementKind>('capital_in');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [movementDate, setMovementDate] = useState(() => toDateString(new Date()));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const data = await getMoneyPosition(activeBusinessId);
      setPosition(data);
      setAccountId((current) => current || data.accounts[0]?.id || '');
      setToAccountId((current) => current || data.accounts[1]?.id || '');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your accounts.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  const accounts = position?.accounts ?? [];
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));
  const selected = accounts.find((a) => a.id === accountId);
  const kindInfo = MOVEMENT_KINDS.find((k) => k.value === kind);
  const isCount = kind === 'adjustment';
  const amountNumber = Number(amount);
  // A cash count records the difference between what was counted and the book balance.
  const difference = isCount && selected && amount !== '' ? amountNumber - selected.balance : 0;
  const finalAmount = isCount ? difference : amountNumber;

  const canSubmit =
    !!activeBusinessId &&
    !!selected &&
    amount !== '' &&
    Number.isFinite(amountNumber) &&
    (isCount ? Math.abs(difference) > 0 : amountNumber > 0) &&
    (kind !== 'transfer' || (!!toAccountId && toAccountId !== accountId)) &&
    /^\d{4}-\d{2}-\d{2}$/.test(movementDate) &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || !activeBusinessId || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await recordMoneyMovement({
        businessId: activeBusinessId,
        kind,
        accountId: selected.id,
        toAccountId: kind === 'transfer' ? toAccountId : null,
        amount: finalAmount,
        movementDate,
        note: note.trim() || null,
        createdBy: userId,
      });
      toast.show('Recorded');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not record this.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Record money" back />
      <Page narrow>
        <SectionLabel>What happened</SectionLabel>
        <ChipRow options={MOVEMENT_KINDS} value={kind} onChange={setKind} />
        {kindInfo ? <p className="text-sm font-medium text-muted">{kindInfo.hint}</p> : null}

        <SectionLabel>{kind === 'transfer' ? 'From' : 'Account'}</SectionLabel>
        <ChipRow options={accountOptions} value={accountId} onChange={setAccountId} />

        {kind === 'transfer' ? (
          <>
            <SectionLabel>To</SectionLabel>
            <ChipRow options={accountOptions} value={toAccountId} onChange={setToAccountId} />
          </>
        ) : null}

        <Field label={isCount ? 'Amount counted' : 'Amount'}>
          <FormInput
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            inputMode="decimal"
          />
        </Field>
        {isCount && selected ? (
          <p className="text-sm font-medium tabular-nums text-muted">
            The app shows {formatMoney(selected.balance)} in {selected.name}.
            {amount !== '' && difference !== 0
              ? ` ${formatMoney(Math.abs(difference))} ${difference > 0 ? 'more' : 'less'} will be recorded.`
              : ''}
          </p>
        ) : null}

        <Field label="Date">
          <FormInput type="date" value={movementDate} max={toDateString(new Date())} onChange={(e) => setMovementDate(e.target.value)} />
        </Field>
        <Field label="Note">
          <FormInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>

        {error ? <MessageBox tone="danger" message={error} /> : null}

        <PrimaryButton label="Record" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
      </Page>
    </>
  );
}
