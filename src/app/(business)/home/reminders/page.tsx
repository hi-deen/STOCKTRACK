'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { formatDate } from '@/lib/format';
import {
  createReminder,
  getReminderSuggestions,
  listPendingReminders,
  setReminderStatus,
} from '@/lib/reminders-api';
import type { Reminder, ReminderSuggestion } from '@/types/reminders';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RemindersPage() {
  const router = useRouter();
  const { activeBusinessId, userId, can } = useBusinessAuth();

  const [suggestions, setSuggestions] = useState<ReminderSuggestion[] | null>(null);
  const [pending, setPending] = useState<Reminder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const [suggestionsData, pendingData] = await Promise.all([
        getReminderSuggestions(activeBusinessId),
        listPendingReminders(activeBusinessId),
      ]);
      setSuggestions(suggestionsData);
      setPending(pendingData);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load reminders.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  async function handleAccept(suggestion: ReminderSuggestion) {
    if (!activeBusinessId) return;
    const key = `${suggestion.type}-${suggestion.shop_id}`;
    setAcceptingKey(key);
    setActionError(null);
    try {
      await createReminder({
        businessId: activeBusinessId,
        shopId: suggestion.shop_id,
        type: suggestion.type,
        title:
          suggestion.type === 'payment'
            ? `Payment reminder — ${suggestion.shop_name}`
            : `Restock reminder — ${suggestion.shop_name}`,
        message: suggestion.suggested_message,
        dueDate: todayDateString(),
        createdBy: userId,
      });
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not create this reminder.'));
    } finally {
      setAcceptingKey(null);
    }
  }

  async function handleSetStatus(reminderId: string, status: 'done' | 'dismissed') {
    setUpdatingId(reminderId);
    setActionError(null);
    try {
      await setReminderStatus(reminderId, status);
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not update this reminder.'));
    } finally {
      setUpdatingId(null);
    }
  }

  if (!activeBusinessId) return null;

  return (
    <>
      <ScreenHeader title="Reminders" back />
      <Page>
        {suggestions === null && pending === null && !loadError ? <SkeletonRows count={4} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}
        {actionError ? <MessageBox tone="danger" message={actionError} /> : null}

        <SectionLabel>Suggestions</SectionLabel>
        {suggestions !== null && suggestions.length === 0 ? (
          <EmptyState icon="bulb-outline" title="No suggestions right now" />
        ) : null}
        <div className="grid gap-3 lg:grid-cols-2">
          {(suggestions ?? []).map((suggestion) => {
            const key = `${suggestion.type}-${suggestion.shop_id}`;
            return (
              // Warning-toned: these are things needing attention.
              <Card key={key} className="space-y-1 !border-warning !bg-warning-soft">
                <p className="text-sm font-bold">{suggestion.shop_name}</p>
                <p className="font-medium text-warning">
                  {suggestion.type === 'payment' ? 'Payment' : 'Restock'} · {suggestion.reason}
                </p>
                <div className="pt-2">
                  <PrimaryButton
                    label="Create reminder"
                    onClick={() => handleAccept(suggestion)}
                    loading={acceptingKey === key}
                  />
                </div>
              </Card>
            );
          })}
        </div>

        <SectionLabel>Pending reminders</SectionLabel>
        {pending !== null && pending.length === 0 ? (
          <EmptyState
            icon="notifications-off-outline"
            title="Nothing pending"
            message="Create a reminder to keep track of follow-ups."
            actionLabel="New reminder"
            onAction={() => router.push('/home/reminders/new')}
          />
        ) : null}
        <div className="grid gap-3 lg:grid-cols-2">
          {(pending ?? []).map((reminder) => (
            <Card key={reminder.id} className="space-y-1">
              <p className="text-sm font-bold">{reminder.title}</p>
              <p className="text-muted">
                {reminder.shop_name ? `${reminder.shop_name} · ` : ''}
                Due {formatDate(reminder.due_date)}
              </p>
              <p className="text-muted">{reminder.message}</p>
              <div className="flex gap-2 pt-2">
                <PrimaryButton
                  label="Dismiss"
                  variant="outline"
                  onClick={() => handleSetStatus(reminder.id, 'dismissed')}
                  disabled={updatingId === reminder.id}
                />
                <PrimaryButton
                  label="Mark done"
                  onClick={() => handleSetStatus(reminder.id, 'done')}
                  loading={updatingId === reminder.id}
                />
              </div>
            </Card>
          ))}
        </div>
      </Page>
      {can('record_sales') ? (
        <Fab label="New reminder" onPress={() => router.push('/home/reminders/new')} />
      ) : null}
    </>
  );
}
