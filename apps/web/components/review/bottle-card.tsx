'use client';

import type { PerfumeRead } from '@perfume/core';
import { Button } from '@/components/ui/button';
import type { QueueResult } from '@/lib/scans/queue';
import { FlagChips } from './flag-chips';
import { PerfumeLines } from './perfume-lines';
import { NoPhoto } from '@/components/ui/no-photo';

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
  wishlist,
  onWishlist,
}: {
  photo: { src: string; full: string } | undefined;
  result: QueueResult;
  read: PerfumeRead;
  busy: boolean;
  onView: (src: string) => void;
  onPickName: (name: string) => void;
  onApprove: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  wishlist: boolean;
  onWishlist: (on: boolean) => void;
}) {
  const alternatives = result.read.alternatives.filter((a) => a !== read.name);
  return (
    <article className="label-card p-4">
      <div className="flex gap-3">
        {photo ? (
          <button onClick={() => onView(photo.full)} aria-label="View photo" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} alt="" loading="lazy" decoding="async" className="h-24 w-24 rounded-[3px] object-cover" />
          </button>
        ) : (
          <NoPhoto className="h-24 w-24" />
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
      <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={wishlist} onChange={(e) => onWishlist(e.target.checked)} className="size-5 accent-oxblood" />
        A tester: add to my wishlist, not my shelf
      </label>
      <div className="mt-1 flex gap-2">
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
