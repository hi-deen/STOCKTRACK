'use client';

import { useEffect, useState } from 'react';

import { Dialog } from '@/components/bottom-sheet';
import { FormTextarea } from '@/components/form-input';
import { MessageBox } from '@/components/message-box';
import { PrimaryButton } from '@/components/primary-button';

interface PromptModalProps {
  visible: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  submitLabel?: string;
  loading?: boolean;
  error?: string | null;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export function PromptModal({
  visible,
  title,
  description,
  placeholder,
  submitLabel = 'Submit',
  loading,
  error,
  onCancel,
  onSubmit,
}: PromptModalProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) setValue('');
  }, [visible]);

  return (
    <Dialog visible={visible} onClose={onCancel} title={title}>
      {description ? <p className="text-muted">{description}</p> : null}
      <FormTextarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        rows={3}
        autoFocus
      />
      {error ? <MessageBox tone="danger" message={error} className="mt-1" /> : null}
      <div className="mt-2 flex items-center justify-end gap-4">
        <button type="button" onClick={onCancel} className="px-2 py-2 text-muted">
          Cancel
        </button>
        <div className="min-w-[100px]">
          <PrimaryButton
            label={submitLabel}
            onClick={() => onSubmit(value.trim())}
            disabled={value.trim().length === 0}
            loading={loading}
          />
        </div>
      </div>
    </Dialog>
  );
}
