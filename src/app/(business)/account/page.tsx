'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BottomSheet } from '@/components/bottom-sheet';
import { BusinessSwitcherList } from '@/components/business-switcher-list';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Icon } from '@/components/icon';
import { Page } from '@/components/page';
import { ScreenHeader } from '@/components/screen-header';
import { SettingsDivider, SettingsRow } from '@/components/settings-row';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { hapticTap } from '@/lib/haptics';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference-context';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System default' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function AccountPage() {
  const router = useRouter();
  const { preference, setPreference } = useThemePreference();
  const { userEmail, memberships, activeBusinessId, activeMembership, setActiveBusinessId, signOut } = useBusinessAuth();
  const isOwner = activeMembership?.role === 'owner';

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const businessName = activeMembership?.business_name ?? 'Your business';
  const initial = businessName.trim().charAt(0).toUpperCase() || 'D';
  const canSwitch = memberships.length > 1;
  const themeLabel = THEME_OPTIONS.find((o) => o.value === preference)?.label ?? 'System default';

  const profile = (
    <>
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-[28px] font-bold text-on-primary">
        {initial}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1">
          <span className="truncate text-[28px] font-semibold leading-9">{businessName}</span>
          {canSwitch ? (
            <span className="text-muted">
              <Icon name="chevron-down" size={20} />
            </span>
          ) : null}
        </span>
        {userEmail ? <span className="block truncate text-muted">{userEmail}</span> : null}
        <span className="block text-sm font-medium text-muted">{isOwner ? 'Owner' : 'Staff'}</span>
      </span>
    </>
  );

  return (
    <>
      <ScreenHeader title="Account" />
      <Page narrow className="!px-0 lg:!px-6">
        {canSwitch ? (
          <button
            type="button"
            onClick={() => {
              hapticTap();
              setSwitcherOpen(true);
            }}
            aria-label={`${businessName}, switch business`}
            className="flex w-full items-center gap-4 px-4 py-4 transition hover:bg-primary-soft sm:px-6">
            {profile}
          </button>
        ) : (
          <div className="flex items-center gap-4 px-4 py-4 sm:px-6">{profile}</div>
        )}

        <SettingsDivider />

        <SettingsRow
          icon="business-outline"
          title="Business settings"
          subtitle="Details and preferences for this business"
          onPress={() => router.push('/account/settings')}
        />
        <SettingsRow
          icon="people-outline"
          title="Members"
          subtitle="Staff who can access this business"
          onPress={() => router.push('/account/members')}
        />
        {isOwner ? (
          <SettingsRow
            icon="bicycle-outline"
            title="Riders"
            subtitle="Dispatch riders and their assignments"
            onPress={() => router.push('/account/riders')}
          />
        ) : null}

        <SettingsDivider />

        <SettingsRow
          icon="document-text-outline"
          title="Activity log"
          subtitle="Who changed what, and when"
          onPress={() => router.push('/account/activity-log')}
        />
        <SettingsRow
          icon="color-palette-outline"
          title="Appearance"
          subtitle={themeLabel}
          onPress={() => setThemeOpen(true)}
        />

        <SettingsDivider />

        <SettingsRow icon="log-out-outline" title="Log out" onPress={() => setLogoutOpen(true)} />
        <SettingsRow
          icon="trash-outline"
          title="Delete account"
          subtitle="Permanently remove your account and data"
          tone="danger"
          onPress={() => router.push('/account/delete-account')}
        />

        <p className="px-4 py-6 text-center text-sm font-medium text-muted">Distro · web</p>
      </Page>

      <BottomSheet visible={switcherOpen} onClose={() => setSwitcherOpen(false)} title="Switch business">
        <BusinessSwitcherList
          memberships={memberships}
          activeBusinessId={activeBusinessId}
          onSelect={(id) => {
            void setActiveBusinessId(id);
            setSwitcherOpen(false);
          }}
        />
      </BottomSheet>

      <BottomSheet visible={themeOpen} onClose={() => setThemeOpen(false)} title="Appearance">
        {THEME_OPTIONS.map((option) => {
          const active = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                hapticTap();
                setPreference(option.value);
                setThemeOpen(false);
              }}
              className="flex w-full items-center gap-4 py-4 text-left">
              <span
                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 ${active ? 'border-primary' : 'border-muted'}`}>
                {active ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
              </span>
              <span className="text-base">{option.label}</span>
            </button>
          );
        })}
      </BottomSheet>

      <ConfirmDialog
        visible={logoutOpen}
        title="Log out?"
        message="You will need to sign in again to use Distro."
        confirmLabel="Log out"
        destructive
        onConfirm={async () => {
          await signOut();
          router.replace('/');
        }}
        onCancel={() => setLogoutOpen(false)}
      />
    </>
  );
}
