import Link from 'next/link';
import { Suspense } from 'react';
import { ScentPyramid } from '@/components/brand/pyramid';
import { WearToday } from '@/components/wears/wear-today';
import type { TodayPick } from '@/lib/today/load';
import { NoPhoto } from '@/components/ui/no-photo';

async function ModelReason({ reasons, id, fallback }: { reasons: Promise<Record<string, string> | null>; id: string; fallback: string }) {
  return <>{(await reasons)?.[id] ?? fallback}</>;
}

/** One of today's picks: photo, house, name, pyramid, reason and a Wear button. */
/**
 * `reasonsKey` changes with Today's context: a fresh Suspense boundary shows the rule reason at
 * once instead of holding the old screen until Claude's new line is ready.
 */
export function PickCard({
  pick,
  rule,
  reasons,
  reasonsKey,
  collectionId,
}: {
  pick: TodayPick;
  rule: string;
  reasons: Promise<Record<string, string> | null>;
  reasonsKey: string;
  collectionId: string;
}) {
  const c = pick.candidate;
  return (
    <li className="label-card p-4">
      <div className="flex gap-3">
        <Link href={`/collection/${c.perfumeId}`} className="flex min-w-0 flex-1 gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {pick.thumb ? <img src={pick.thumb} alt="" className="h-16 w-16 shrink-0 rounded-[3px] object-cover" /> : <NoPhoto className="h-16 w-16" />}
          <div className="min-w-0">
            {c.sample && <p className="text-[12px] text-muted">Sample{c.setName ? ` · ${c.setName}` : ''}</p>}
            <p className="truncate text-[12px] tracking-[0.14em] text-muted uppercase">{c.house}</p>
            <p className="font-display text-[19px] leading-snug text-ink">{c.name}</p>
            <p className="mt-0.5 text-[14px] text-muted italic">
              <Suspense key={reasonsKey} fallback={rule}>
                <ModelReason reasons={reasons} id={c.perfumeId} fallback={rule} />
              </Suspense>
            </p>
          </div>
        </Link>
        <ScentPyramid weight={c.weight} size={30} />
      </div>
      <WearToday collectionId={collectionId} itemId={c.itemId} label="Wear" refresh={false} variant="secondary" className="mt-3" />
    </li>
  );
}
