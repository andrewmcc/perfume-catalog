'use client';

import { useState } from 'react';
import { londonNow, type Daypart } from '@perfume/core';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/collection/confirm-button';
import { StarRating } from './star-rating';
import { NOTES_MAX, wearPatch, type WearFormValue, type WearPatch } from './wear-patch';

const TIMES: [Daypart, string][] = [
  ['day', 'Day'],
  ['evening', 'Evening'],
  ['night', 'Night'],
];

/** Date, time of day, stars and notes for one wear. */
export function WearForm({
  initial,
  saveLabel = 'Save',
  showDate = true,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: WearFormValue;
  saveLabel?: string;
  showDate?: boolean;
  onSave: (p: WearPatch) => Promise<void>;
  onCancel?: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [f, setF] = useState<WearFormValue>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => onSave(wearPatch(f, londonNow(new Date()).date)));
      }}
    >
      {showDate && (
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Date
          <input
            type="date"
            required
            max={londonNow(new Date()).date}
            value={f.wornOn}
            onChange={(e) => setF({ ...f, wornOn: e.target.value })}
            className="min-h-11 rounded-[3px] border border-line bg-card px-3 text-[16px] text-ink focus:border-oxblood focus:outline-none"
          />
        </label>
      )}
      <fieldset>
        <legend className="text-sm text-muted">Time of day</legend>
        <div className="mt-1.5 flex gap-2">
          {TIMES.map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={f.timeOfDay === v}
              onClick={() => setF({ ...f, timeOfDay: f.timeOfDay === v ? null : v })}
              className={`min-h-11 rounded-full border px-4 text-sm ${f.timeOfDay === v ? 'border-oxblood bg-oxblood text-paper' : 'border-line text-ink'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <p className="text-sm text-muted">Rating</p>
        <StarRating value={f.rating} onChange={(rating) => setF({ ...f, rating })} className="-ml-2" />
      </div>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Notes
        <textarea
          value={f.notes}
          maxLength={NOTES_MAX}
          rows={3}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
          placeholder="How did it wear?"
          className="rounded-[3px] border border-line bg-card px-3 py-2 text-[16px] text-ink placeholder:text-muted/70 focus:border-oxblood focus:outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {saveLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="quiet" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        {onDelete && (
          <span className="ml-auto">
            <ConfirmButton label="Delete" confirm="Delete this wear?" disabled={busy} onConfirm={() => void run(onDelete)} />
          </span>
        )}
      </div>
    </form>
  );
}
