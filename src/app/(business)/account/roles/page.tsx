'use client';

import { useCallback, useState } from 'react';

import { Card } from '@/components/card';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { SwitchRow } from '@/components/switch-row';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { getRolePermissions, setRolePermissions } from '@/lib/members-api';
import {
  ASSIGNABLE_ROLES,
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AssignableRole,
  type Permission,
} from '@/lib/permissions';

type Grants = Record<AssignableRole, Permission[]>;

export default function RolesPage() {
  const toast = useToast();
  const { activeBusinessId, activeMembership, refetchMemberships } = useBusinessAuth();
  const isOwner = activeMembership?.role === 'owner';

  const [grants, setGrants] = useState<Grants | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId || dirty) return;
    try {
      const rows = await getRolePermissions(activeBusinessId);
      const next: Grants = { admin: [], staff: [], observer: [] };
      for (const row of rows) next[row.role]?.push(row.permission);
      setGrants(next);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load roles.'));
    }
  }, [activeBusinessId, dirty]);

  useFocusEffect(load);

  function toggle(role: AssignableRole, permission: Permission, on: boolean) {
    if (!grants || !isOwner || saving) return;
    const current = grants[role].filter((p) => p !== permission);
    setGrants({ ...grants, [role]: on ? [...current, permission] : current });
    setDirty(true);
  }

  async function handleSave() {
    if (!activeBusinessId || !grants) return;
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all(ASSIGNABLE_ROLES.map((role) => setRolePermissions(activeBusinessId, role, grants[role])));
      setDirty(false);
      await refetchMemberships();
      toast.show('Permissions saved');
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Could not save permissions.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ScreenHeader title="Roles & permissions" back />
      <Page narrow>
        <MessageBox
          tone="neutral"
          message={
            isOwner
              ? 'Choose what each role can do. As the owner you can always do everything, and only you can manage members, invites and roles.'
              : 'Only the owner can change what each role can do.'
          }
        />

        {grants === null && !loadError ? <SkeletonRows count={6} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}

        {grants
          ? ASSIGNABLE_ROLES.map((role) => (
              <section key={role} className="space-y-2">
                <SectionLabel>{ROLE_LABELS[role]}</SectionLabel>
                <p className="text-sm font-medium text-muted">{ROLE_DESCRIPTIONS[role]}</p>
                <Card className="divide-y divide-line !py-1">
                  {PERMISSIONS.map((permission) => (
                    <SwitchRow
                      key={permission.key}
                      label={permission.label}
                      value={grants[role].includes(permission.key)}
                      onChange={(on) => toggle(role, permission.key, on)}
                    />
                  ))}
                </Card>
              </section>
            ))
          : null}

        {saveError ? <MessageBox tone="danger" message={saveError} /> : null}

        {isOwner && grants ? (
          <PrimaryButton label="Save permissions" onClick={handleSave} disabled={!dirty || saving} loading={saving} />
        ) : null}
      </Page>
    </>
  );
}
