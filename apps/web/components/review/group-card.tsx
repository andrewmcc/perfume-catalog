'use client';

import type { PerfumeRead } from '@perfume/core';
import { Button } from '@/components/ui/button';
import type { QueueResult, QueueScan } from '@/lib/scans/queue';
import { FlagChips } from './flag-chips';
import { PerfumeLines } from './perfume-lines';

/** A samples or set photo: the whole photo, then one tickable row per read. */
export function GroupCard({
  scan,
  results,
  readOf,
  ticked,
  setFields,
  busy,
  onView,
  onToggle,
  onEdit,
  onSetField,
  onApprove,
  onDismiss,
}: {
  scan: QueueScan;
  results: QueueResult[];
  readOf: (r: QueueResult) => PerfumeRead;
  ticked: (id: string) => boolean;
  setFields: { set_house: string; set_name: string } | null;
  busy: boolean;
  onView: (src: string) => void;
  onToggle: (id: string) => void;
  onEdit: (r: QueueResult) => void;
  onSetField: (k: 'set_house' | 'set_name', v: string) => void;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const n = results.filter((r) => ticked(r.id)).length;
  const input = 'min-h-11 w-full rounded-[3px] border border-line bg-card px-3 text-[16px] text-ink focus:border-oxblood focus:outline-none';
  return (
    <article className="label-card p-4">
      <p className="text-[12px] tracking-[0.14em] text-muted uppercase">{scan.mode === 'set' ? 'Discovery set' : 'Samples'}</p>
      {scan.photos.map(({ src, full }, i) => (
        <button key={full} onClick={() => onView(full)} aria-label={`View photo ${i + 1}`} className="mt-2 block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" loading="lazy" decoding="async" className="max-h-72 w-full rounded-[3px] object-contain bg-line-soft" />
        </button>
      ))}
      {setFields && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Set house
            <input className={input} value={setFields.set_house} onChange={(e) => onSetField('set_house', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            Set name
            <input className={input} value={setFields.set_name} onChange={(e) => onSetField('set_name', e.target.value)} />
          </label>
        </div>
      )}
      <ul className="mt-3">
        {results.map((r) => (
          <li key={r.id} className="flex items-start gap-3 border-b border-line-soft py-2.5 last:border-0">
            <input
              type="checkbox"
              checked={ticked(r.id)}
              onChange={() => onToggle(r.id)}
              aria-label={`Keep ${readOf(r).name ?? 'this vial'}`}
              className="mt-1 size-5 shrink-0 accent-oxblood"
            />
            <div className={`min-w-0 flex-1 ${ticked(r.id) ? '' : 'opacity-50'}`}>
              <PerfumeLines read={readOf(r)} />
              <FlagChips flags={r.flags} />
            </div>
            <button onClick={() => onEdit(r)} className="min-h-11 px-2 text-sm text-oxblood underline underline-offset-4">
              Edit
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Button onClick={onApprove} disabled={busy} className="flex-1">
          {n === 0 ? 'Discard all' : `Approve ${n}`}
        </Button>
        <Button variant="quiet" onClick={onDismiss} disabled={busy}>
          Dismiss
        </Button>
      </div>
    </article>
  );
}
