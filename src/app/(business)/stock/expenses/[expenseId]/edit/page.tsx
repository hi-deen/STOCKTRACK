'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { PressableCard } from '@/components/card';
import { Field, FormInput, FormTextarea } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { editExpense, getExpense, listExpenseCategories } from '@/lib/expenses-api';
import { toDateString } from '@/lib/format';
import type { Expense, ExpenseCategory } from '@/types/stock';

export default function EditExpensePage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();
  const { expenseId } = useParams<{ expenseId: string }>();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId || !expenseId) return;
    try {
      const [expenseData, categoriesData] = await Promise.all([getExpense(expenseId), listExpenseCategories(activeBusinessId)]);
      setExpense(expenseData);
      setCategories(categoriesData);
      setCategoryId(expenseData.category_id);
      setAmount(String(expenseData.amount));
      setExpenseDate(expenseData.expense_date);
      setNote(expenseData.note ?? '');
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load this expense.'));
    }
  }, [activeBusinessId, expenseId]);

  useFocusEffect(load);

  const amountNumber = Number(amount);
  const canSubmit =
    !!expense &&
    !!categoryId &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(expenseDate) &&
    reason.trim().length > 0 &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || !expense || !categoryId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await editExpense({
        expenseId: expense.id,
        categoryId,
        amount: amountNumber,
        expenseDate,
        note: note.trim() || null,
        reason: reason.trim(),
      });
      toast.show('Expense updated');
      router.back();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not update this expense.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Edit expense" back />
      <Page narrow>
        {expense === null && !loadError ? <Skeleton height={48} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {expense ? (
          <>
            <SectionLabel>Category</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <PressableCard
                  key={category.id}
                  selected={category.id === categoryId}
                  onClick={() => setCategoryId(category.id)}
                  className="!w-auto">
                  <span className="text-sm font-bold">{category.name}</span>
                </PressableCard>
              ))}
            </div>

            <Field label="Amount">
              <FormInput value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" />
            </Field>
            <Field label="Date">
              <FormInput type="date" value={expenseDate} max={toDateString(new Date())} onChange={(e) => setExpenseDate(e.target.value)} />
            </Field>
            <Field label="Note">
              <FormTextarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" rows={2} />
            </Field>
            <Field label="Reason for edit">
              <FormInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required" />
            </Field>

            {submitError ? <MessageBox tone="danger" message={submitError} /> : null}

            <PrimaryButton label="Save changes" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
          </>
        ) : null}
      </Page>
    </>
  );
}
