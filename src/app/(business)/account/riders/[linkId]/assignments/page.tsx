'use client';

import { useParams } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Card, PressableCard } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { MessageBox } from '@/components/message-box';
import { Page, SectionLabel } from '@/components/page';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenHeader } from '@/components/screen-header';
import { SkeletonRows } from '@/components/skeleton';
import { useToast } from '@/components/toast';
import { useFocusEffect } from '@/hooks/use-focus-effect';
import { useBusinessAuth } from '@/lib/business-auth-context';
import { getErrorMessage } from '@/lib/error-message';
import { deleteRiderAssignment, listRiderAssignments, upsertRiderAssignment } from '@/lib/riders-management-api';
import { listShops } from '@/lib/shops-api';
import type { Shop } from '@/types/catalog';
import type { RiderAssignmentRow } from '@/types/riders-management';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function DayToggles({ selected, onToggle }: { selected: number[]; onToggle: (day: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {DAY_LABELS.map((label, day) => {
        const active = selected.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(day)}
            className={`flex-1 rounded-full border px-1 py-2 text-sm font-medium transition ${
              active ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted hover:bg-primary-soft'
            }`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function RiderAssignmentsPage() {
  const toast = useToast();
  const { activeBusinessId } = useBusinessAuth();
  const { linkId } = useParams<{ linkId: string }>();

  const [assignments, setAssignments] = useState<RiderAssignmentRow[] | null>(null);
  const [editedDays, setEditedDays] = useState<Record<string, number[]>>({});
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newShopId, setNewShopId] = useState<string | null>(null);
  const [newDays, setNewDays] = useState<number[]>([]);
  const [addingNew, setAddingNew] = useState(false);
  const [toRemove, setToRemove] = useState<RiderAssignmentRow | null>(null);

  const load = useCallback(async () => {
    if (!activeBusinessId || !linkId) return;
    try {
      const [assignmentData, shopData] = await Promise.all([listRiderAssignments(linkId), listShops(activeBusinessId)]);
      setAssignments(assignmentData);
      setEditedDays(Object.fromEntries(assignmentData.map((a) => [a.id, a.days_of_week])));
      setShops(shopData.filter((s) => s.is_active));
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load assignments.'));
    }
  }, [activeBusinessId, linkId]);

  useFocusEffect(load);

  function toggleExistingDay(assignmentId: string, day: number) {
    setEditedDays((prev) => {
      const current = prev[assignmentId] ?? [];
      const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
      return { ...prev, [assignmentId]: next };
    });
  }

  async function handleSave(assignment: RiderAssignmentRow) {
    if (!linkId) return;
    setSavingId(assignment.id);
    setActionError(null);
    try {
      await upsertRiderAssignment(linkId, assignment.shop_id, editedDays[assignment.id] ?? []);
      await load();
      toast.show('Assignment saved');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not save this assignment.'));
    } finally {
      setSavingId(null);
    }
  }

  async function runRemoveAssignment() {
    if (!toRemove) return;
    const assignment = toRemove;
    setSavingId(assignment.id);
    setActionError(null);
    try {
      await deleteRiderAssignment(assignment.id);
      await load();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not remove this assignment.'));
    } finally {
      setSavingId(null);
      setToRemove(null);
    }
  }

  async function handleAddAssignment() {
    if (!linkId || !newShopId) return;
    setAddingNew(true);
    setActionError(null);
    try {
      await upsertRiderAssignment(linkId, newShopId, newDays);
      setNewShopId(null);
      setNewDays([]);
      await load();
      toast.show('Shop assigned');
    } catch (err) {
      setActionError(getErrorMessage(err, 'Could not add this assignment.'));
    } finally {
      setAddingNew(false);
    }
  }

  if (!activeBusinessId || !linkId) return null;

  const assignedShopIds = new Set((assignments ?? []).map((a) => a.shop_id));
  const unassignedShops = (shops ?? []).filter((s) => !assignedShopIds.has(s.id));

  return (
    <>
      <ScreenHeader title="Shop assignments" back />
      <Page narrow>
        {assignments === null && !loadError ? <SkeletonRows count={3} avatar={false} /> : null}
        {loadError ? <MessageBox tone="danger" message={loadError} /> : null}
        {actionError ? <MessageBox tone="danger" message={actionError} /> : null}

        {(assignments ?? []).map((assignment) => (
          <Card key={assignment.id} className="space-y-3">
            <p className="text-sm font-bold">{assignment.shop_name}</p>
            <DayToggles selected={editedDays[assignment.id] ?? []} onToggle={(day) => toggleExistingDay(assignment.id, day)} />
            <div className="flex items-center justify-between">
              <button type="button" className="font-medium text-danger" onClick={() => setToRemove(assignment)}>
                Remove
              </button>
              <div className="w-28">
                <PrimaryButton label="Save" onClick={() => handleSave(assignment)} loading={savingId === assignment.id} />
              </div>
            </div>
          </Card>
        ))}

        {unassignedShops.length > 0 ? (
          <>
            <SectionLabel>Add a shop</SectionLabel>
            <div className="grid gap-2 sm:grid-cols-2">
              {unassignedShops.map((shop) => (
                <PressableCard key={shop.id} selected={shop.id === newShopId} onClick={() => setNewShopId(shop.id)}>
                  {shop.name}
                </PressableCard>
              ))}
            </div>
            {newShopId ? (
              <Card className="space-y-3">
                <DayToggles
                  selected={newDays}
                  onToggle={(day) =>
                    setNewDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()))
                  }
                />
                <PrimaryButton label="Add assignment" onClick={handleAddAssignment} loading={addingNew} />
              </Card>
            ) : null}
          </>
        ) : null}
      </Page>

      <ConfirmDialog
        visible={!!toRemove}
        title="Remove this shop assignment?"
        message={`${toRemove?.shop_name ?? 'This shop'} will no longer appear on this rider's route.`}
        confirmLabel="Remove"
        destructive
        onConfirm={runRemoveAssignment}
        onCancel={() => setToRemove(null)}
      />
    </>
  );
}
