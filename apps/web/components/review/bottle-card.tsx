'use client';

import type { PerfumeRead } from '@perfume/core';
import { Button } from '@/components/ui/button';
import type { QueueResult } from '@/lib/scans/queue';
import { FlagChips } from './flag-chips';
import { PerfumeLines } from './perfume-lines';

/** One bottle scan: photo, the read, and Approve / Edit / Discard. */
export function BottleCard({
  photo,
  result,
  read,
  busy,
  onView,
  onPickName,
  onApprove,
  onEdit,
  onDiscard,
}: {
  photo: string | undefined;
  result: QueueResult;
  read: PerfumeRead;
  busy: boolean;
  onView: (src: string) => void;
  onPickName: (name: string) => void;
  onApprove: () => void;
  onEdit: () => void;
  onDiscard: () => void;
}) {
  const alternatives = result.read.alternatives.filter((a) => a !== read.name);
  return (
    <article className="label-card p-4">
      <div className="flex gap-3">
        {photo ? (
          <button onClick={() => onView(photo)} aria-label="View photo" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="h-24 w-24 rounded-[3px] object-cover" />
          </button>
        ) : (
          <div className="h-24 w-24 shrink-0 rounded-[3px] bg-line-soft" />
        )}
        <div className="min-w-0 flex-1">
          <PerfumeLines read={read} />
          <FlagChips flags={result.flags} />
          {alternatives.length > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
              or:
              {alternatives.map((a) => (
                <button key={a} onClick={() => onPickName(a)} className="min-h-9 rounded-full border border-line px-2.5 text-ink hover:border-oxblood">
                  {a}
                </button>
              ))}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={onApprove} disabled={busy} className="flex-1">
          Approve
        </Button>
        <Button variant="secondary" onClick={onEdit} disabled={busy}>
          Edit
        </Button>
        <Button variant="quiet" onClick={onDiscard} disabled={busy}>
          Discard
        </Button>
      </div>
    </article>
  );
}
