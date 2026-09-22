'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { BackToTopButton } from '@/components/back-to-top-button';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { listExpenseCategories, listExpenses } from '@/lib/expenses-api';
import { formatDate, formatMoney } from '@/lib/format';
import type { Expense, ExpenseCategory } from '@/types/stock';

export default function ExpensesListPage() {
  const router = useRouter();
  const { activeBusinessId } = useBusinessAuth();

  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [categories, setCategories] = useState<Map<string, ExpenseCategory>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [expensesData, categoriesData] = await Promise.all([
        listExpenses(activeBusinessId),
        listExpenseCategories(activeBusinessId),
      ]);
      setExpenses(expensesData);
      setCategories(new Map(categoriesData.map((c) => [c.id, c])));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load expenses.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  if (!activeBusinessId) return null;

  const total = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);

  return (
    <>
      <ScreenHeader
        title="Expenses"
        back
        primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]}
        overflowActions={[
          { icon: 'pricetags-outline', label: 'Categories', onPress: () => router.push('/stock/expenses/categories') },
        ]}
      />
      <Page narrow>
        {expenses !== null ? <p className="text-muted">Total: {formatMoney(total)}</p> : null}

        {expenses === null && !loadError ? <SkeletonRows /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {expenses !== null && expenses.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="No expenses yet"
            message="Recorded expenses will appear here."
            actionLabel="Add expense"
            onAction={() => router.push('/stock/expenses/new')}
          />
        ) : null}

        <div>
          {(expenses ?? []).map((expense) => (
            <ListRow
              key={expense.id}
              title={categories.get(expense.category_id)?.name ?? 'Unknown category'}
              subtitle={`${formatDate(expense.expense_date)}${expense.note ? ` · ${expense.note}` : ''}`}
              trailingText={formatMoney(expense.amount)}
            />
          ))}
        </div>
      </Page>
      <Fab label="New expense" onPress={() => router.push('/stock/expenses/new')} />
      <BackToTopButton />
    </>
  );
}
