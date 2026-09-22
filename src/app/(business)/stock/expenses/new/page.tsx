'use client';

import { useRouter } from 'next/navigation';
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
import { createExpense, listExpenseCategories } from '@/lib/expenses-api';
import { toDateString } from '@/lib/format';
import type { ExpenseCategory } from '@/types/stock';

export default function NewExpensePage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, userId } = useBusinessAuth();

  const [categories, setCategories] = useState<ExpenseCategory[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => toDateString(new Date()));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      setCategories(await listExpenseCategories(activeBusinessId));
    } catch (err) {
      setCategoriesError(getErrorMessage(err, 'Could not load expense categories.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  const amountNumber = Number(amount);
  const canSubmit =
    !!activeBusinessId &&
    !!categoryId &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(expenseDate) &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit || !activeBusinessId || !categoryId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createExpense(
        activeBusinessId,
        { category_id: categoryId, amount: amountNumber, expense_date: expenseDate, note: note.trim() || null },
        userId,
      );
      toast.show('Expense added');
      router.back();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not record this expense.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="New expense" back />
      <Page narrow>
        {categories === null && !categoriesError ? <Skeleton height={48} /> : null}
        {categoriesError ? <MessageBox tone="danger" message={categoriesError} /> : null}

        {categories !== null ? (
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
              <FormInput
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                inputMode="decimal"
              />
            </Field>
            <Field label="Date">
              <FormInput type="date" value={expenseDate} max={toDateString(new Date())} onChange={(e) => setExpenseDate(e.target.value)} />
            </Field>
            <Field label="Note">
              <FormTextarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" rows={2} />
            </Field>

            {submitError ? <MessageBox tone="danger" message={submitError} /> : null}

            <PrimaryButton label="Record expense" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
          </>
        ) : null}
      </Page>
    </>
  );
}
