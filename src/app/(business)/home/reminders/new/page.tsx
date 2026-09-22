'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { PressableCard } from '@/components/card';
import { Field, FormInput, FormTextarea } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { Skeleton } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { createReminder } from '@/lib/reminders-api';
import { listShops } from '@/lib/shops-api';
import type { Shop } from '@/types/catalog';

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function NewReminderPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, userId } = useBusinessAuth();

  const [shops, setShops] = useState<Shop[] | null>(null);
  const [shopsError, setShopsError] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [dueDate, setDueDate] = useState(todayDateString());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const data = await listShops(activeBusinessId);
      setShops(data.filter((s) => s.is_active));
      setShopsError(null);
    } catch (err) {
      setShopsError(getErrorMessage(err, 'Could not load shops.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  const canSubmit =
    !!activeBusinessId && title.trim().length > 0 && message.trim().length > 0 && DATE_PATTERN.test(dueDate) && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !activeBusinessId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createReminder({
        businessId: activeBusinessId,
        shopId: selectedShopId,
        type: 'custom',
        title: title.trim(),
        message: message.trim(),
        dueDate,
        createdBy: userId,
      });
      toast.show('Reminder created');
      router.back();
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not create this reminder.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="New reminder" back />
      <Page narrow>
        <Field label="Title">
          <FormInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call about order" />
        </Field>
        <Field label="Message">
          <FormTextarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What should this reminder say?"
          />
        </Field>
        <Field label="Due date">
          <FormInput
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            error={dueDate.length > 0 && !DATE_PATTERN.test(dueDate) ? 'Pick a valid date.' : null}
          />
        </Field>

        <div className="space-y-2">
          <span className="block text-sm font-bold">Shop (optional)</span>
          {shopsError ? <MessageBox tone="danger" message={shopsError} /> : null}
          {shops === null && !shopsError ? <Skeleton height={48} /> : null}
          {shops !== null ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <PressableCard onClick={() => setSelectedShopId(null)} selected={selectedShopId === null}>
                General reminder (no shop)
              </PressableCard>
              {shops.map((shop) => (
                <PressableCard key={shop.id} onClick={() => setSelectedShopId(shop.id)} selected={selectedShopId === shop.id}>
                  {shop.name}
                </PressableCard>
              ))}
            </div>
          ) : null}
        </div>

        {submitError ? <MessageBox tone="danger" message={submitError} /> : null}

        <PrimaryButton label="Create reminder" onClick={handleSubmit} disabled={!canSubmit} loading={submitting} />
      </Page>
    </>
  );
}
