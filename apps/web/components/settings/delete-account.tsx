'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Delete account, confirmed by typing "delete". */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: typed.trim() }) });
    if (res.ok) {
      window.location.assign('/login');
      return;
    }
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setError(json.error ?? 'Couldn’t delete your account. Try again.');
    setBusy(false);
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-sm text-danger underline underline-offset-4">
        Delete account
      </button>
    );
  return (
    <div className="mt-2 rounded-[3px] border border-danger/50 p-3">
      <p className="text-sm text-ink">
        This deletes your login for good. If nobody else shares your collection, everything in it goes too: bottles, samples, sets, photos and your diary. It can’t be undone.
      </p>
      <label className="mt-3 block text-sm text-muted">
        Type <span className="font-medium text-ink">delete</span> to confirm
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="mt-1 min-h-11 w-full rounded-[3px] border border-line bg-card px-3 text-[16px] text-ink focus:border-danger focus:outline-none"
        />
      </label>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => void remove()} disabled={busy || typed.trim() !== 'delete'} className="flex-1 bg-danger shadow-none hover:bg-danger/90">
          {busy ? 'Deleting…' : 'Delete my account'}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="status" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
