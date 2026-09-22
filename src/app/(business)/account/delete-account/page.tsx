'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Field, FormInput } from '@/components/form-input';
import { ListRow } from '@/components/list-row';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton, Spinner } from '@/components/primary-button';
import { PromptModal } from '@/components/prompt-modal';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import {
  deleteBusinessEntirely,
  deleteMyAccount,
  getSoleOwnerships,
  transferBusinessOwnership,
  verifyCurrentPassword,
  type SoleOwnership,
} from '@/lib/account-deletion-api';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { getBusinessMembers } from '@/lib/members-api';
import type { BusinessMember } from '@/types/riders-management';

export default function DeleteAccountPage() {
  const router = useRouter();
  const toast = useToast();
  const { userEmail, signOut } = useBusinessAuth();

  const [ownerships, setOwnerships] = useState<SoleOwnership[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [transferTarget, setTransferTarget] = useState<SoleOwnership | null>(null);
  const [transferMembers, setTransferMembers] = useState<BusinessMember[] | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferringUserId, setTransferringUserId] = useState<string | null>(null);

  const [deleteBusinessTarget, setDeleteBusinessTarget] = useState<SoleOwnership | null>(null);
  const [deleteBusinessLoading, setDeleteBusinessLoading] = useState(false);
  const [deleteBusinessError, setDeleteBusinessError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOwnerships(await getSoleOwnerships());
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not check your businesses.'));
    }
  }, []);

  useFocusEffect(load);

  async function openTransfer(ownership: SoleOwnership) {
    setTransferTarget(ownership);
    setTransferError(null);
    setTransferMembers(null);
    try {
      const members = await getBusinessMembers(ownership.business_id);
      setTransferMembers(members.filter((m) => m.role !== 'owner'));
    } catch (err) {
      setTransferError(getErrorMessage(err, 'Could not load members.'));
    }
  }

  async function handleTransfer(newOwnerUserId: string) {
    if (!transferTarget) return;
    setTransferringUserId(newOwnerUserId);
    setTransferError(null);
    try {
      await transferBusinessOwnership(transferTarget.business_id, newOwnerUserId);
      setTransferTarget(null);
      await load();
      toast.show('Ownership transferred');
    } catch (err) {
      setTransferError(getErrorMessage(err, 'Could not transfer ownership.'));
    } finally {
      setTransferringUserId(null);
    }
  }

  async function handleDeleteBusinessSubmit(typedName: string) {
    if (!deleteBusinessTarget) return;
    if (typedName.trim().toLowerCase() !== deleteBusinessTarget.business_name.trim().toLowerCase()) {
      setDeleteBusinessError("That name doesn't match. Nothing was deleted.");
      return;
    }
    setDeleteBusinessLoading(true);
    setDeleteBusinessError(null);
    try {
      await deleteBusinessEntirely(deleteBusinessTarget.business_id);
      setDeleteBusinessTarget(null);
      await load();
      toast.show('Business deleted');
    } catch (err) {
      setDeleteBusinessError(getErrorMessage(err, 'Could not delete this business.'));
    } finally {
      setDeleteBusinessLoading(false);
    }
  }

  async function runDeleteAccount() {
    if (!userEmail || password.trim().length === 0) return;
    setDeletingAccount(true);
    setAccountError(null);
    try {
      await verifyCurrentPassword(userEmail, password);
      await deleteMyAccount();
      await signOut();
      router.replace('/');
    } catch (err) {
      setConfirmOpen(false);
      setAccountError(getErrorMessage(err, 'Could not delete your account.'));
    } finally {
      setDeletingAccount(false);
    }
  }

  const isResolved = ownerships !== null && ownerships.length === 0;

  return (
    <>
      <ScreenHeader title="Delete account" back />
      <Page narrow>
        {ownerships === null && !loadError ? <SkeletonRows count={2} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {ownerships && ownerships.length > 0 ? (
          <>
            <MessageBox
              tone="warning"
              message="You're the sole owner of the business(es) below. Resolve each one — transfer it or delete it — before you can delete your account."
            />
            {ownerships.map((o) => (
              <Card key={o.business_id} className="space-y-2">
                <p className="text-sm font-bold">{o.business_name}</p>
                <p className="text-sm font-medium text-muted">
                  {o.other_members_count} other member{o.other_members_count === 1 ? '' : 's'}
                </p>
                <div className="flex gap-2 pt-1">
                  <PrimaryButton
                    label="Transfer ownership"
                    variant="outline"
                    onClick={() => openTransfer(o)}
                    disabled={o.other_members_count === 0}
                  />
                  <PrimaryButton
                    label="Delete business"
                    variant="danger"
                    onClick={() => {
                      setDeleteBusinessTarget(o);
                      setDeleteBusinessError(null);
                    }}
                  />
                </div>
                {o.other_members_count === 0 ? (
                  <p className="text-sm font-medium text-muted">
                    No other members to transfer to — deleting the business is the only option.
                  </p>
                ) : null}
              </Card>
            ))}
          </>
        ) : null}

        {isResolved ? (
          <>
            <SectionLabel>Delete your account</SectionLabel>
            <p className="text-muted">
              This permanently deletes your account and removes your access to every business you belong to. This cannot be
              undone.
            </p>
            <Field label="Confirm your password">
              <FormInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </Field>
            {accountError ? <MessageBox tone="danger" message={accountError} /> : null}
            <PrimaryButton
              label="Delete my account"
              variant="danger"
              onClick={() => setConfirmOpen(true)}
              disabled={password.trim().length === 0}
            />
          </>
        ) : null}
      </Page>

      <BottomSheet
        visible={!!transferTarget}
        onClose={() => setTransferTarget(null)}
        title={`Transfer ownership of ${transferTarget?.business_name ?? ''}`}>
        <p className="mb-2 text-sm font-medium text-muted">This member becomes the owner; you become staff on this business.</p>
        {transferError ? <MessageBox tone="danger" message={transferError} /> : null}
        <div className="max-h-72 overflow-y-auto">
          {transferMembers === null && !transferError ? (
            <div className="flex justify-center py-4 text-primary">
              <Spinner />
            </div>
          ) : (
            (transferMembers ?? []).map((member) => (
              <ListRow
                key={member.user_id}
                title={member.email ?? member.user_id}
                subtitle="Staff"
                onClick={() => handleTransfer(member.user_id)}
                trailing={
                  transferringUserId === member.user_id ? (
                    <span className="text-primary">
                      <Spinner />
                    </span>
                  ) : undefined
                }
              />
            ))
          )}
        </div>
      </BottomSheet>

      <PromptModal
        visible={!!deleteBusinessTarget}
        title={`Delete ${deleteBusinessTarget?.business_name}?`}
        description={`This permanently deletes the business and everything in it — shops, deliveries, payments, members. Everyone loses access. This cannot be undone. Type the business name exactly to confirm: ${deleteBusinessTarget?.business_name}`}
        placeholder="Business name"
        submitLabel="Delete business"
        loading={deleteBusinessLoading}
        error={deleteBusinessError}
        onCancel={() => {
          setDeleteBusinessTarget(null);
          setDeleteBusinessError(null);
        }}
        onSubmit={handleDeleteBusinessSubmit}
      />

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete your account?"
        message="This permanently deletes your account and removes your access to every business you belong to. This cannot be undone."
        confirmLabel="Delete my account"
        destructive
        loading={deletingAccount}
        onConfirm={runDeleteAccount}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
