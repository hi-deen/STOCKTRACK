'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { ActionSheet } from '@/components/bottom-sheet';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { CopyableCode } from '@/components/copyable-code';
import { EmptyState } from '@/components/empty-state';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { generateRiderInviteCode, getBusinessRiders, removeRiderLink } from '@/lib/riders-management-api';
import type { BusinessRiderLink } from '@/types/riders-management';

export default function RidersPage() {
  const router = useRouter();
  const { activeBusinessId } = useBusinessAuth();
  const toast = useToast();

  const [sheetLink, setSheetLink] = useState<BusinessRiderLink | null>(null);
  const [toRemove, setToRemove] = useState<BusinessRiderLink | null>(null);
  const [riders, setRiders] = useState<BusinessRiderLink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      setRiders(await getBusinessRiders(activeBusinessId));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load riders.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  async function handleGenerateCode() {
    if (!activeBusinessId) return;
    setGenerating(true);
    setActionError(null);
    setGeneratedCode(null);
    try {
      setGeneratedCode(await generateRiderInviteCode(activeBusinessId));
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not generate an invite code.'));
    } finally {
      setGenerating(false);
    }
  }

  async function runRemove() {
    if (!toRemove) return;
    const link = toRemove;
    setRemovingLinkId(link.id);
    setActionError(null);
    try {
      await removeRiderLink(link.id);
      await load();
      toast.show('Rider removed');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not remove this rider.'));
    } finally {
      setRemovingLinkId(null);
      setToRemove(null);
    }
  }

  if (!activeBusinessId) return null;

  const activeRiders = riders?.filter((r) => r.status === 'active') ?? [];
  const removedRiders = riders?.filter((r) => r.status === 'removed') ?? [];

  return (
    <>
      <ScreenHeader title="Riders" back />
      <Page narrow>
        <PrimaryButton label="Generate rider invite code" variant="outline" onClick={handleGenerateCode} loading={generating} />
        {generatedCode ? (
          <MessageBox tone="success">
            <p className="text-success">Share this code (expires in 30 days):</p>
            <div className="pt-2 text-fg">
              <CopyableCode code={generatedCode} />
            </div>
          </MessageBox>
        ) : null}

        {actionError ? <MessageBox tone="danger" message={actionError} /> : null}
        {riders === null && !loadError ? <SkeletonRows count={4} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        <SectionLabel>Active riders</SectionLabel>
        {riders !== null && activeRiders.length === 0 ? (
          <EmptyState
            icon="bicycle-outline"
            title="No active riders yet"
            message="Generate an invite code and share it with your rider."
          />
        ) : null}
        <div>
          {activeRiders.map((link) => (
            <ListRow
              key={link.id}
              title={link.rider_full_name}
              subtitle={link.rider_phone}
              leading={<Avatar name={link.rider_full_name} />}
              onClick={removingLinkId === link.id ? undefined : () => setSheetLink(link)}
            />
          ))}
        </div>

        {removedRiders.length > 0 ? (
          <>
            <SectionLabel>Removed</SectionLabel>
            <div>
              {removedRiders.map((link) => (
                <ListRow
                  key={link.id}
                  title={link.rider_full_name}
                  subtitle={link.rider_phone}
                  leading={<Avatar name={link.rider_full_name} />}
                  trailing={<Badge tone="neutral" label="Removed" />}
                />
              ))}
            </div>
          </>
        ) : null}
      </Page>

      <ActionSheet
        visible={sheetLink !== null}
        onClose={() => setSheetLink(null)}
        title={sheetLink?.rider_full_name}
        actions={[
          {
            icon: 'calendar-outline',
            label: 'Manage shop assignments',
            onPress: () => {
              if (sheetLink) router.push(`/account/riders/${sheetLink.id}/assignments`);
            },
          },
          {
            icon: 'person-remove-outline',
            label: 'Remove rider',
            tone: 'danger',
            onPress: () => setToRemove(sheetLink),
          },
        ]}
      />

      <ConfirmDialog
        visible={!!toRemove}
        title="Remove rider?"
        message={`${toRemove?.rider_full_name ?? 'This rider'} will lose access to this business and all their shop assignments will stop applying. This cannot be undone.`}
        confirmLabel="Remove"
        destructive
        loading={!!removingLinkId}
        onConfirm={runRemove}
        onCancel={() => setToRemove(null)}
      />
    </>
  );
}
