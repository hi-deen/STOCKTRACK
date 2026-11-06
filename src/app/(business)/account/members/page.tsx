'use client';

import { useCallback, useState } from 'react';

import { ActionSheet } from '@/components/bottom-sheet';
import { Avatar } from '@/components/avatar';
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
import { formatDate } from '@/lib/format';
import { generateInviteCode, getBusinessMembers, removeBusinessMember, setMemberRole } from '@/lib/members-api';
import { ASSIGNABLE_ROLES, roleLabel, type AssignableRole } from '@/lib/permissions';
import type { BusinessMember } from '@/types/riders-management';

export default function MembersPage() {
  const { activeBusinessId, activeMembership, userId } = useBusinessAuth();
  const isOwner = activeMembership?.role === 'owner';
  const toast = useToast();

  const [sheetMember, setSheetMember] = useState<BusinessMember | null>(null);
  const [toRemove, setToRemove] = useState<BusinessMember | null>(null);
  const [members, setMembers] = useState<BusinessMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      setMembers(await getBusinessMembers(activeBusinessId));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load members.'));
    }
  }, [activeBusinessId]);

  useFocusEffect(load);

  async function handleGenerateCode() {
    if (!activeBusinessId) return;
    setGenerating(true);
    setActionError(null);
    setGeneratedCode(null);
    try {
      setGeneratedCode(await generateInviteCode(activeBusinessId));
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not generate an invite code.'));
    } finally {
      setGenerating(false);
    }
  }

  async function runRemove() {
    if (!activeBusinessId || !toRemove) return;
    const member = toRemove;
    setRemovingUserId(member.user_id);
    setActionError(null);
    try {
      await removeBusinessMember(activeBusinessId, member.user_id);
      await load();
      toast.show('Member removed');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not remove this member.'));
    } finally {
      setRemovingUserId(null);
      setToRemove(null);
    }
  }

  async function changeRole(member: BusinessMember, role: AssignableRole) {
    if (!activeBusinessId) return;
    setActionError(null);
    try {
      await setMemberRole(activeBusinessId, member.user_id, role);
      await load();
      toast.show(`${member.email ?? 'Member'} is now ${roleLabel(role).toLowerCase()}`);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not change this role.'));
    }
  }

  if (!activeBusinessId) return null;

  return (
    <>
      <ScreenHeader title="Members" back />
      <Page narrow>
        {isOwner ? (
          <>
            <PrimaryButton label="Generate invite code" variant="outline" onClick={handleGenerateCode} loading={generating} />
            {generatedCode ? (
              <MessageBox tone="success">
                <p className="text-success">Share this code (expires in 7 days):</p>
                <div className="pt-2 text-fg">
                  <CopyableCode code={generatedCode} />
                </div>
              </MessageBox>
            ) : null}
          </>
        ) : null}

        {actionError ? <MessageBox tone="danger" message={actionError} /> : null}
        {members === null && !loadError ? <SkeletonRows count={4} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        <SectionLabel>Current members</SectionLabel>
        {members !== null && members.length === 0 ? (
          <EmptyState icon="people-outline" title="No members yet" message="Generate an invite code to add staff." />
        ) : null}
        <div>
          {(members ?? []).map((member) => {
            const canManage = isOwner && member.user_id !== userId;
            return (
              <ListRow
                key={member.user_id}
                title={member.email ?? member.user_id}
                subtitle={`${roleLabel(member.role)} · joined ${formatDate(member.joined_at.slice(0, 10))}`}
                leading={<Avatar name={member.email ?? member.user_id} />}
                onClick={canManage && removingUserId !== member.user_id ? () => setSheetMember(member) : undefined}
              />
            );
          })}
        </div>
      </Page>

      <ActionSheet
        visible={sheetMember !== null}
        onClose={() => setSheetMember(null)}
        title={sheetMember?.email ?? 'Member'}
        actions={[
          ...ASSIGNABLE_ROLES.filter((role) => role !== sheetMember?.role).map((role) => ({
            icon: 'people-outline' as const,
            label: `Make ${roleLabel(role).toLowerCase()}`,
            onPress: () => {
              if (sheetMember) changeRole(sheetMember, role);
            },
          })),
          {
            icon: 'person-remove-outline',
            label: 'Remove member',
            tone: 'danger',
            onPress: () => setToRemove(sheetMember),
          },
        ]}
      />

      <ConfirmDialog
        visible={!!toRemove}
        title="Remove member?"
        message={`${toRemove?.email ?? 'This member'} will lose access to this business. This cannot be undone.`}
        confirmLabel="Remove"
        destructive
        loading={!!removingUserId}
        onConfirm={runRemove}
        onCancel={() => setToRemove(null)}
      />
    </>
  );
}
