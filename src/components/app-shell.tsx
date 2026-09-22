'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Icon, type IconName } from '@/components/icon';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import { useBusinessAuth } from '@/lib/business-auth-context';

// Split into its own chunk: it pulls in Dexie (the offline-cache database),
// which every business page would otherwise pay to parse/execute even
// though only Operations and the delivery/payment forms ever write to it.
// ssr:false since it only ever has anything to show once IndexedDB has been
// read, client-side.
const OfflineSyncBanner = dynamic(
  () => import('@/components/offline-sync-banner').then((m) => m.OfflineSyncBanner),
  { ssr: false },
);

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
}

// Same five tabs as the mobile app's bottom bar, in the same order.
const NAV: NavItem[] = [
  { href: '/operations', label: 'Today', icon: 'today-outline', activeIcon: 'today' },
  { href: '/shops', label: 'Shops', icon: 'storefront-outline', activeIcon: 'storefront' },
  { href: '/stock', label: 'Stock', icon: 'cube-outline', activeIcon: 'cube' },
  { href: '/reports', label: 'Reports', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  { href: '/account', label: 'Account', icon: 'person-circle-outline', activeIcon: 'person-circle' },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Responsive shell: bottom tab bar on phones (the mobile design), a fixed
// left sidebar with the same tabs on large screens.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeMembership } = useBusinessAuth();

  return (
    <div className="min-h-screen bg-app lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-header text-xl font-bold text-on-header">
            D
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-fg">Distro</p>
            {activeMembership ? (
              <p className="truncate text-sm text-muted">{activeMembership.business_name}</p>
            ) : null}
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Main">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-3 text-base font-medium transition ${
                  active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-primary-soft hover:text-fg'
                }`}>
                <Icon name={active ? item.activeIcon : item.icon} size={22} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0">
        <div className="mx-auto max-w-5xl px-4 pt-3 lg:px-6">
          <PWAInstallBanner />
        </div>
        <OfflineSyncBanner />
        {children}
      </div>

      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface lg:hidden">
        <ul className="mx-auto flex max-w-xl">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium ${
                    active ? 'text-primary' : 'text-muted'
                  }`}>
                  <Icon name={active ? item.activeIcon : item.icon} size={24} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
