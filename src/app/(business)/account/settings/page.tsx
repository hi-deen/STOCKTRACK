'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { PromptModal } from '@/components/prompt-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SettingsRow } from '@/components/settings-row';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { deleteBusinessEntirely } from '@/lib/account-deletion-api';
import { getBusinessSettings, saveBusinessSettings } from '@/lib/business-settings-api';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';

export default function BusinessSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeBusinessId, activeMembership, refetchMemberships } = useBusinessAuth();
  const isOwner = activeMembership?.role === 'owner';
  const businessName = activeMembership?.business_name ?? 'this business';

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paymentDays, setPaymentDays] = useState('14');
  const [restockDays, setRestockDays] = useState('7');
  const [displayName, setDisplayName] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId || dirty) return;
    try {
      const data = await getBusinessSettings(activeBusinessId);
      setPaymentDays(String(data.payment_reminder_days));
      setRestockDays(String(data.restock_reminder_days));
      setDisplayName(data.business_display_name ?? '');
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load settings.'));
    } finally {
      setLoaded(true);
    }
  }, [activeBusinessId, dirty]);

  useFocusEffect(load);

  const paymentDaysNumber = Number(paymentDays);
  const restockDaysNumber = Number(restockDays);
  const canSubmit =
    !!activeBusinessId &&
    isOwner &&
    Number.isFinite(paymentDaysNumber) &&
    paymentDaysNumber > 0 &&
    Number.isFinite(restockDaysNumber) &&
    restockDaysNumber > 0 &&
    !saving;

  async function handleSave() {
    if (!canSubmit || !activeBusinessId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveBusinessSettings(activeBusinessId, {
        payment_reminder_days: paymentDaysNumber,
        restock_reminder_days: restockDaysNumber,
        business_display_name: displayName.trim() || null,
      });
      setDirty(false);
      toast.show('Settings saved');
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Could not save settings.'));
    } finally {
      setSaving(false);
    }
  }

  const touch = (fn: () => void) => {
    setDirty(true);
    fn();
  };

  // Deletes this specific business (not the caller's account) — any current
  // owner can do this, distinct from the sole-ownership resolution inside
  // account deletion. The (business)/layout.tsx redirect and
  // business-auth-context's active-business re-pick both fire off
  // refetchMemberships(), same as leaving a business.
  async function handleDeleteSubmit(typedName: string) {
    if (!activeBusinessId) return;
    if (typedName.trim().toLowerCase() !== businessName.trim().toLowerCase()) {
      setDeleteError("That name doesn't match. Nothing was deleted.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBusinessEntirely(activeBusinessId);
      await refetchMemberships();
      setDeleteOpen(false);
      toast.show('Business deleted');
      router.replace('/operations');
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete this business.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Business settings" back />
      <Page narrow>
        {!loaded && !loadError ? <SkeletonRows count={3} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}
        {!isOwner ? <MessageBox tone="neutral" message="Only business owners can change these settings." /> : null}

        {loaded ? (
          <>
            <Field label="Business display name">
              <FormInput
                value={displayName}
                onChange={(e) => touch(() => setDisplayName(e.target.value))}
                placeholder="Shown on messages to shops"
                disabled={!isOwner}
              />
            </Field>
            <Field label="Payment reminder threshold (days)">
              <FormInput
                value={paymentDays}
                onChange={(e) => touch(() => setPaymentDays(e.target.value.replace(/[^0-9]/g, '')))}
                inputMode="numeric"
                disabled={!isOwner}
              />
            </Field>
            <Field label="Restock reminder threshold (days)">
              <FormInput
                value={restockDays}
                onChange={(e) => touch(() => setRestockDays(e.target.value.replace(/[^0-9]/g, '')))}
                inputMode="numeric"
                disabled={!isOwner}
              />
            </Field>

            {saveError ? <MessageBox tone="danger" message={saveError} /> : null}

            {isOwner ? <PrimaryButton label="Save settings" onClick={handleSave} disabled={!canSubmit} loading={saving} /> : null}

            {isOwner ? (
              <>
                <SectionLabel className="pt-4">Danger zone</SectionLabel>
                <div className="-mx-4 lg:mx-0">
                  <SettingsRow
                    icon="trash-outline"
                    title="Delete this business"
                    subtitle="Permanently delete it and everything in it"
                    tone="danger"
                    onPress={() => setDeleteOpen(true)}
                  />
                </div>
                {deleteError && !deleteOpen ? <MessageBox tone="danger" message={deleteError} /> : null}
              </>
            ) : null}
          </>
        ) : null}
      </Page>

      <PromptModal
        visible={deleteOpen}
        title={`Delete ${businessName}?`}
        description={`This permanently deletes the business and everything in it — shops, deliveries, payments, members. Everyone loses access. This cannot be undone. Type the business name exactly to confirm: ${businessName}`}
        placeholder="Business name"
        submitLabel="Delete business"
        loading={deleting}
        error={deleteError}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
        onSubmit={handleDeleteSubmit}
      />
    </>
  );
}
