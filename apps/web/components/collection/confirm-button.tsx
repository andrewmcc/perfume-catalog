'use client';

import { useState } from 'react';

/** A destructive action that asks "Sure?" inline instead of a browser dialog. */
export function ConfirmButton({ label, confirm, onConfirm, disabled }: { label: string; confirm: string; onConfirm: () => void; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking)
    return (
      <button onClick={() => setAsking(true)} disabled={disabled} className="min-h-11 px-1 text-sm text-danger underline underline-offset-4">
        {label}
      </button>
    );
  return (
    <span className="inline-flex items-center gap-3 text-sm" role="group" aria-label={confirm}>
      <span className="text-ink">{confirm}</span>
      <button onClick={onConfirm} disabled={disabled} className="min-h-11 px-1 font-medium text-danger underline underline-offset-4">
        Yes, delete
      </button>
      <button onClick={() => setAsking(false)} className="min-h-11 px-1 text-muted underline underline-offset-4">
        Cancel
      </button>
    </span>
  );
}
