'use client';

import { useEffect, useState } from 'react';

import { Icon } from '@/components/icon';
import { hapticTap } from '@/lib/haptics';

export const BACK_TO_TOP_THRESHOLD = 400;

// Floating scroll-to-top action for long list screens; shows once the page
// has scrolled past the shared threshold. Sits just above the FAB slot.
export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > BACK_TO_TOP_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => {
        hapticTap();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-md lg:bottom-28 lg:right-9">
      <Icon name="arrow-up" size={22} />
    </button>
  );
}
