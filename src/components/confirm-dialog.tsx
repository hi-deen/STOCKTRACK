'use client';

import { Dialog } from '@/components/bottom-sheet';
import { PrimaryButton } from '@/components/primary-button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Web replacement for Alert.alert(title, message, [Cancel, Confirm]).
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog visible={visible} onClose={onCancel} title={title}>
      {message ? <p className="text-muted">{message}</p> : null}
      <div className="flex items-center justify-end gap-4 pt-3">
        <button type="button" onClick={onCancel} className="px-2 py-2 text-muted">
          Cancel
        </button>
        <div className="min-w-[110px]">
          <PrimaryButton
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          />
        </div>
      </div>
    </Dialog>
  );
}
