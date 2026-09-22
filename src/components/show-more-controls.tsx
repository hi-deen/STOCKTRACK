'use client';

import { hapticTap } from '@/lib/haptics';

interface ShowMoreControlsProps {
  onShowMore?: () => void;
  showMoreLabel?: string;
  onOpenAll?: () => void;
  openAllLabel?: string;
}

export function ShowMoreControls({
  onShowMore,
  showMoreLabel = 'Show more',
  onOpenAll,
  openAllLabel = 'Open all',
}: ShowMoreControlsProps) {
  if (!onShowMore && !onOpenAll) return null;

  return (
    <div className="flex justify-between py-2">
      {onShowMore ? (
        <button
          type="button"
          className="text-sm font-bold text-primary"
          onClick={() => {
            hapticTap();
            onShowMore();
          }}>
          {showMoreLabel}
        </button>
      ) : (
        <span />
      )}
      {onOpenAll ? (
        <button
          type="button"
          className="text-sm font-bold text-primary"
          onClick={() => {
            hapticTap();
            onOpenAll();
          }}>
          {openAllLabel}
        </button>
      ) : null}
    </div>
  );
}
