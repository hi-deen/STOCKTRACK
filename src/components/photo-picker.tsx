'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';

import { PrimaryButton } from '@/components/primary-button';

interface PhotoPickerProps {
  file: File | null;
  existingUrl?: string | null;
  onChange: (file: File | null) => void;
}

// Take a photo with the camera (on phones) or choose one from the library /
// disk. Web equivalent of the mobile image picker.
export function PhotoPicker({ file, existingUrl, onChange }: PhotoPickerProps) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) onChange(picked);
    e.target.value = '';
  }

  const shown = previewUrl ?? existingUrl ?? null;

  return (
    <div className="space-y-2">
      {shown ? <img src={shown} alt="Shop" className="h-48 w-full rounded-md object-cover" /> : null}
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={handle} />
      <input ref={libraryInput} type="file" accept="image/*" className="hidden" onChange={handle} />
      <div className="flex gap-2">
        <PrimaryButton label="Take photo" variant="outline" onClick={() => cameraInput.current?.click()} />
        <PrimaryButton label="Choose from library" variant="outline" onClick={() => libraryInput.current?.click()} />
      </div>
    </div>
  );
}
