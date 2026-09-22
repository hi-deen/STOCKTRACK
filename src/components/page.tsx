import type { ReactNode } from 'react';

// Standard content column for every screen: centred, capped width, with
// enough bottom padding to clear the mobile tab bar and the floating button.
export function Page({
  children,
  narrow,
  className = '',
}: {
  children: ReactNode;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <main
      className={`mx-auto w-full ${narrow ? 'max-w-2xl' : 'max-w-5xl'} space-y-4 px-4 pb-32 pt-4 lg:px-6 lg:pb-24 lg:pt-6 ${className}`}>
      {children}
    </main>
  );
}

// Small uppercase section heading (mobile's `sectionLabel` text style).
export function SectionLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`text-[13px] font-bold uppercase tracking-wider text-muted ${className}`}>{children}</h2>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[26px] font-bold leading-8 text-fg">{children}</h1>;
}

// Full-width centred column for auth / onboarding screens.
export function CenteredPage({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-6 py-10">
      {children}
    </main>
  );
}

// Grid that lays cards out in one column on phones and more on wide screens.
export function CardGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>{children}</div>;
}
