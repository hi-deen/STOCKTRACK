'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/badge';
import { Dialog } from '@/components/bottom-sheet';
import { Card } from '@/components/card';
import { Field, FormInput } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { Skeleton } from '@/components/skeleton';
import { getErrorMessage } from '@/lib/error-message';
import { getRiderHomeData, redeemRiderInviteCode, updateRiderLinkStatus } from '@/lib/rider-api';
import { useRiderAuth } from '@/lib/rider-auth-context';
import { supabase } from '@/lib/supabase';
import type { RiderHomeLink } from '@/types/rider';

export default function RiderHomePage() {
  const router = useRouter();
  const { token, fullName, logout } = useRiderAuth();

  const [links, setLinks] = useState<RiderHomeLink[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [respondingLinkId, setRespondingLinkId] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deletePin, setDeletePin] = useState('');
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLinks(await getRiderHomeData(token));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load your businesses.'));
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRespond(linkId: string, status: 'active' | 'declined') {
    if (!token) return;
    setRespondingLinkId(linkId);
    try {
      await updateRiderLinkStatus(token, linkId, status);
      await load();
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not update that request.'));
    } finally {
      setRespondingLinkId(null);
    }
  }

  async function handleRedeem() {
    if (!token || inviteCode.trim().length === 0) return;
    setRedeemLoading(true);
    setRedeemError(null);
    setRedeemSuccess(null);
    try {
      await redeemRiderInviteCode(token, inviteCode.trim());
      setInviteCode('');
      setRedeemSuccess('Business added.');
      await load();
    } catch (err) {
      setRedeemError(getErrorMessage(err, 'Could not redeem that code.'));
    } finally {
      setRedeemLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!token) return;
    setDeleteError(null);
    if (!deletePin) {
      setDeleteError('Enter your PIN to confirm.');
      return;
    }
    if (!deleteAck) {
      setDeleteError('Please confirm you understand this cannot be undone.');
      return;
    }
    setDeleteLoading(true);
    const { data, error } = await supabase.rpc('rider_delete_account', {
      token_input: token,
      pin_input: deletePin,
    });
    if (error || !data || (data as { deleted?: boolean }).deleted !== true) {
      setDeleteError(error?.message ?? 'Could not delete your account. Please try again.');
      setDeleteLoading(false);
      return;
    }
    await logout();
    router.replace('/rider/login?deleted=1');
  }

  const pendingLinks = links?.filter((l) => l.status === 'pending') ?? [];
  const activeLinks = links?.filter((l) => l.status === 'active') ?? [];
  const removedLinks = links?.filter((l) => l.status === 'removed') ?? [];

  return (
    <>
      <ScreenHeader
        title={`Hi${fullName ? `, ${fullName}` : ''}`}
        subtitle="Rider"
        primaryActions={[{ icon: 'refresh', label: 'Refresh', onPress: load }]}
        overflowActions={[
          { icon: 'trash-outline', label: 'Delete account', onPress: () => setShowDelete(true) },
          {
            icon: 'log-out-outline',
            label: 'Log out',
            onPress: async () => {
              await logout();
              router.replace('/rider/login');
            },
          },
        ]}
      />
      <Page narrow>
        <PrimaryButton label="View today's route" onClick={() => router.push('/rider/route')} />

        {links === null && !loadError ? <Skeleton height={64} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {removedLinks.length > 0 ? (
          <>
            <SectionLabel>Removed</SectionLabel>
            {removedLinks.map((link) => (
              <MessageBox
                key={link.link_id}
                tone="warning"
                message={`${link.business_name} removed you from their business.`}
              />
            ))}
          </>
        ) : null}

        <SectionLabel>Pending requests</SectionLabel>
        {links !== null && pendingLinks.length === 0 ? (
          <p className="text-muted">No pending requests.</p>
        ) : (
          pendingLinks.map((link) => (
            <Card key={link.link_id} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{link.business_name}</span>
                <Badge label={link.requested_via === 'owner_invite' ? 'Invited' : 'Requested'} tone="primary" />
              </div>
              <div className="flex gap-2">
                <PrimaryButton
                  label="Decline"
                  variant="outline"
                  onClick={() => handleRespond(link.link_id, 'declined')}
                  disabled={respondingLinkId === link.link_id}
                />
                <PrimaryButton
                  label="Accept"
                  onClick={() => handleRespond(link.link_id, 'active')}
                  loading={respondingLinkId === link.link_id}
                />
              </div>
            </Card>
          ))
        )}

        <SectionLabel>Have an invite code?</SectionLabel>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <FormInput
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. 4F9A2C1D"
              autoCapitalize="characters"
              autoCorrect="off"
            />
          </div>
          <div className="w-24">
            <PrimaryButton
              label="Add"
              onClick={handleRedeem}
              disabled={inviteCode.trim().length === 0}
              loading={redeemLoading}
            />
          </div>
        </div>
        {redeemError ? <p className="text-danger">{redeemError}</p> : null}
        {redeemSuccess ? <p className="text-success">{redeemSuccess}</p> : null}

        <SectionLabel>Your businesses</SectionLabel>
        {links !== null && activeLinks.length === 0 ? (
          <p className="text-muted">You&apos;re not linked to any businesses yet.</p>
        ) : (
          activeLinks.map((link) => (
            <Card key={link.link_id} className="flex items-center justify-between">
              <span className="text-sm font-bold">{link.business_name}</span>
              <Badge
                label={`${link.assigned_shop_count} ${link.assigned_shop_count === 1 ? 'shop' : 'shops'}`}
                tone="success"
              />
            </Card>
          ))
        )}
      </Page>

      <Dialog
        visible={showDelete}
        onClose={() => {
          if (deleteLoading) return;
          setShowDelete(false);
          setDeletePin('');
          setDeleteAck(false);
          setDeleteError(null);
        }}
        title="Delete account">
        <p className="text-muted">
          This permanently deletes your rider account and its data. It cannot be undone.
        </p>
        <Field label="Enter your PIN to confirm">
          <FormInput
            type="password"
            inputMode="numeric"
            value={deletePin}
            onChange={(e) => setDeletePin(e.target.value.replace(/[^0-9]/g, ''))}
            maxLength={6}
            autoComplete="current-password"
          />
        </Field>
        <label className="flex items-start gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={deleteAck}
            onChange={(e) => setDeleteAck(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>I understand my account and data will be permanently deleted.</span>
        </label>
        {deleteError ? <MessageBox tone="danger" message={deleteError} /> : null}
        <div className="space-y-2 pt-2">
          <PrimaryButton
            variant="danger"
            label="Permanently delete my account"
            onClick={handleDeleteAccount}
            disabled={!deletePin || !deleteAck}
            loading={deleteLoading}
          />
          <PrimaryButton
            variant="outline"
            label="Cancel"
            disabled={deleteLoading}
            onClick={() => {
              setShowDelete(false);
              setDeletePin('');
              setDeleteAck(false);
              setDeleteError(null);
            }}
          />
        </div>
      </Dialog>
    </>
  );
}
