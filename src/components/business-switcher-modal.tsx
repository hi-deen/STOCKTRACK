'use client';

import { Dialog } from '@/components/bottom-sheet';
import { BusinessSwitcherList } from '@/components/business-switcher-list';
import type { BusinessMembership } from '@/types/business';

interface BusinessSwitcherModalProps {
  visible: boolean;
  memberships: BusinessMembership[];
  activeBusinessId: string | null;
  onSelect: (businessId: string) => void;
  onClose: () => void;
}

export function BusinessSwitcherModal({
  visible,
  memberships,
  activeBusinessId,
  onSelect,
  onClose,
}: BusinessSwitcherModalProps) {
  return (
    <Dialog visible={visible} onClose={onClose} title="Your businesses">
      <BusinessSwitcherList
        memberships={memberships}
        activeBusinessId={activeBusinessId}
        onSelect={(id) => {
          onSelect(id);
          onClose();
        }}
      />
    </Dialog>
  );
}
