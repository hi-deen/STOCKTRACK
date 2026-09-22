'use client';

import { useCallback, useState } from 'react';

import { Badge } from '@/components/badge';
import { ActionSheet } from '@/components/bottom-sheet';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { FormInput } from '@/components/form-input';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { createExpenseCategory, deleteExpenseCategory, listExpenseCategories } from '@/lib/expenses-api';
import type { ExpenseCategory } from '@/types/stock';

export default function ExpenseCategoriesPage() {
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();

  const [categories, setCategories] = useState<ExpenseCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExpenseCategory | null>(null);
  const [toDelete, setToDelete] = useState<ExpenseCategory | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      setCategories(await listExpenseCategories(activeBusinessId));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load expense categories.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  async function handleAdd() {
    if (!activeBusinessId || !newName.trim() || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      await createExpenseCategory(activeBusinessId, newName.trim());
      setNewName('');
      toast.show('Category added');
      await load();
    } catch (err) {
      setAddError(getErrorMessage(err, 'Could not add this category.'));
    } finally {
      setAdding(false);
    }
  }

  async function runDelete() {
    if (!toDelete) return;
    try {
      await deleteExpenseCategory(toDelete.id);
      toast.show('Category deleted');
      await load();
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not delete this category.'));
    } finally {
      setToDelete(null);
    }
  }

  if (!activeBusinessId) return null;

  return (
    <>
      <ScreenHeader title="Expense categories" back />
      <Page narrow>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAdd();
          }}>
          <FormInput value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category name" />
          {addError ? <MessageBox tone="danger" message={addError} /> : null}
          <PrimaryButton type="submit" label="+ Add category" disabled={!newName.trim()} loading={adding} />
        </form>

        {categories === null && !loadError ? <SkeletonRows /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {categories !== null && categories.length === 0 ? (
          <EmptyState icon="pricetags-outline" title="No categories yet" message="Add a category above to organise your expenses." />
        ) : null}

        <div>
          {(categories ?? []).map((category) => (
            <ListRow
              key={category.id}
              title={category.name}
              onClick={() => setSelected(category)}
              trailing={category.is_default ? <Badge label="Default" /> : undefined}
            />
          ))}
        </div>
      </Page>

      <ActionSheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name}
        actions={[
          {
            icon: 'trash-outline',
            label: 'Delete',
            tone: 'danger',
            onPress: () => setToDelete(selected),
          },
        ]}
      />

      <ConfirmDialog
        visible={!!toDelete}
        title="Delete category?"
        message="Expenses already recorded under it keep their record; this only removes it from future choices."
        confirmLabel="Delete"
        destructive
        onConfirm={runDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
