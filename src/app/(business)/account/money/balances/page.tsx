'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Card } from '@/components/card';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { toDateString } from '@/lib/format';
import { listMoneyAccounts, updateMoneyAccountOpening, type MoneyAccount } from '@/lib/money-api';

interface Draft {
  balance: string;
  date: string;
}

export default function MoneyBalancesPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();

  const [accounts, setAccounts] = useState<MoneyAccount[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const data = await listMoneyAccounts(activeBusinessId);
      setAccounts(data);
      setDrafts(Object.fromEntries(data.map((a) => [a.id, { balance: String(a.opening_balance), date: a.opening_date }])));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your accounts.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  function patch(id: string, next: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...next } }));
  }

  const valid = (accounts ?? []).every((a) => {
    const draft = drafts[a.id];
    return !!draft && draft.balance !== '' && Number.isFinite(Number(draft.balance)) && /^\d{4}-\d{2}-\d{2}$/.test(draft.date);
  });

  async function handleSave() {
    if (!accounts || !valid) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all(accounts.map((a) => updateMoneyAccountOpening(a.id, Number(drafts[a.id].balance), drafts[a.id].date)));
      toast.show('Balances saved');
      router.back();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the balances.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Starting balances" back />
      <Page narrow>
        <MessageBox
          tone="neutral"
          message="Enter how much was in each account on the starting date. Only money moving on or after that date changes the balance, so earlier records are left out."
        />

        {accounts === null && !error ? <SkeletonRows count={2} avatar={false} /> : null}

        {(accounts ?? []).map((account) => (
          <Card key={account.id} className="space-y-2">
            <p className="text-sm font-bold">{account.name}</p>
            <Field label="Balance on the starting date">
              <FormInput
                value={drafts[account.id]?.balance ?? ''}
                onChange={(e) => patch(account.id, { balance: e.target.value.replace(/[^0-9.-]/g, '') })}
                inputMode="decimal"
              />
            </Field>
            <Field label="Starting date">
              <FormInput
                type="date"
                value={drafts[account.id]?.date ?? ''}
                max={toDateString(new Date())}
                onChange={(e) => patch(account.id, { date: e.target.value })}
              />
            </Field>
          </Card>
        ))}

        {error ? <MessageBox tone="danger" message={error} /> : null}

        {accounts ? <PrimaryButton label="Save balances" onClick={handleSave} disabled={!valid || saving} loading={saving} /> : null}
      </Page>
    </>
  );
}
