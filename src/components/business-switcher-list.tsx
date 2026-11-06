import { Badge } from '@/components/badge';
import { PressableCard } from '@/components/card';
import type { BusinessMembership } from '@/types/business';
import { roleLabel } from '@/lib/permissions';

interface BusinessSwitcherListProps {
  memberships: BusinessMembership[];
  activeBusinessId: string | null;
  onSelect: (businessId: string) => void;
}

// Shared between Account's inline switcher and Home's tappable-title
// switcher modal.
export function BusinessSwitcherList({ memberships, activeBusinessId, onSelect }: BusinessSwitcherListProps) {
  return (
    <>
      {memberships.map((membership) => {
        const active = membership.business_id === activeBusinessId;
        return (
          <PressableCard
            key={membership.business_id}
            selected={active}
            onClick={() => onSelect(membership.business_id)}
            className="mb-2">
            <span className="flex items-center justify-between">
              <span className="text-sm font-bold text-fg">{membership.business_name}</span>
              {active ? <Badge tone="success" label="Active" /> : null}
            </span>
            <span className="mt-0.5 block text-sm font-medium text-muted">
              {roleLabel(membership.role)}
            </span>
          </PressableCard>
        );
      })}
    </>
  );
}
