'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { BackToTopButton } from '@/components/back-to-top-button';
import { ActionSheet } from '@/components/bottom-sheet';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PromptModal } from '@/components/prompt-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { deleteExpense, listExpenseCategories, listExpenses } from '@/lib/expenses-api';
import { formatDate, formatMoney } from '@/lib/format';
import type { Expense, ExpenseCategory } from '@/types/stock';

export default function ExpensesListPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, can } = useBusinessAuth();
  const canEditStockRecords = can('manage_stock_records');

  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [categories, setCategories] = useState<Map<string, ExpenseCategory>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleDelete(reason: string) {
    if (!selected) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteExpense(selected.id, reason.trim());
      setDeleteOpen(false);
      toast.show('Expense deleted');
      await load();
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete this expense.'));
    } finally {
      setDeleting(false);
    }
  }

  if (!activeBusinessId) return null;

  const total = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);
  const selectedName = selected ? (categories.get(selected.category_id)?.name ?? 'Expense') : '';

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

        {expenses !== null && expenses.length > 0 && !canEditStockRecords ? (
          <p className="text-sm font-medium text-muted">You do not have permission to edit or delete expenses.</p>
        ) : null}

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
              onClick={
                canEditStockRecords
                  ? () => {
                      setSelected(expense);
                      setSheetOpen(true);
                    }
                  : undefined
              }
              title={categories.get(expense.category_id)?.name ?? 'Unknown category'}
              subtitle={`${formatDate(expense.expense_date)}${expense.note ? ` · ${expense.note}` : ''}`}
              trailingText={formatMoney(expense.amount)}
            />
          ))}
        </div>
      </Page>
      {can('record_stock') ? (
        <Fab label="New expense" onPress={() => router.push('/stock/expenses/new')} />
      ) : null}
      <ActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={selectedName}
        actions={[
          { icon: 'create-outline', label: 'Edit expense', onPress: () => router.push(`/stock/expenses/${selected?.id}/edit`) },
          {
            icon: 'trash-outline',
            label: 'Delete expense',
            tone: 'danger',
            onPress: () => {
              setDeleteError(null);
              setDeleteOpen(true);
            },
          },
        ]}
      />
      <PromptModal
        visible={deleteOpen}
        title="Delete expense"
        description={`This removes the ${selectedName} expense of ${formatMoney(selected?.amount ?? 0)}. It can't be undone.`}
        placeholder="Reason for deleting"
        submitLabel="Delete"
        loading={deleting}
        error={deleteError}
        onCancel={() => setDeleteOpen(false)}
        onSubmit={handleDelete}
      />
      <BackToTopButton />
    </>
  );
}
