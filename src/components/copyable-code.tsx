'use client';

import { useEffect, useState } from 'react';

import { Icon } from '@/components/icon';
import { hapticSuccess, hapticTap } from '@/lib/haptics';

// Generated invite code + a real copy button. The checkmark reverts after 2s.
export function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    hapticTap();
    try {
      await navigator.clipboard.writeText(code);
      hapticSuccess();
      setCopied(true);
    } catch {
      // Clipboard blocked — the code text stays selectable.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="select-all text-4xl font-semibold tabular-nums tracking-[0.12em] text-fg">{code}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy code"
        className="rounded-md p-2 text-primary transition hover:bg-primary-soft">
        <Icon name={copied ? 'checkmark' : 'copy-outline'} size={22} />
      </button>
    </div>
  );
}
