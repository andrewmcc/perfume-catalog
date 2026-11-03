'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StarRating } from '@/components/wears/star-rating';
import { useWears } from '@/components/wears/use-wears';
import { WearForm } from '@/components/wears/wear-form';
import { longDay } from '@/lib/dates';
import type { DiaryWear } from '@/lib/wears/load';

const TIME = { day: 'Day', evening: 'Evening', night: 'Night' } as const;

/** One day's wears, each with an inline editor. */
export function DayEntries({ date, wears, collectionId }: { date: string; wears: DiaryWear[]; collectionId: string }) {
  const router = useRouter();
  const api = useWears(collectionId);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section aria-label={longDay(date)} className="mt-5">
      <h2 className="text-[12px] tracking-[0.14em] text-muted uppercase">{longDay(date)}</h2>
      {wears.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing logged on this day.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {wears.map((w) => (
            <li key={w.id} className="label-card p-4">
              <div className="flex items-start justify-between gap-3">
                {w.onShelf ? (
                  <Link href={`/collection/${w.perfumeId}`} className="min-w-0">
                    <p className="truncate text-[12px] tracking-[0.14em] text-muted uppercase">{w.house}</p>
                    <p className="font-display text-[18px] leading-snug text-ink">{w.name}</p>
                  </Link>
                ) : (
                  <div className="min-w-0">
                    <p className="truncate text-[12px] tracking-[0.14em] text-muted uppercase">{w.house}</p>
                    <p className="font-display text-[18px] leading-snug text-ink">{w.name}</p>
                  </div>
                )}
                {editing !== w.id && (
                  <button onClick={() => setEditing(w.id)} className="min-h-11 shrink-0 px-1 text-sm text-oxblood underline underline-offset-4">
                    Edit
                  </button>
                )}
              </div>
              {editing === w.id ? (
                <div className="mt-3">
                  <WearForm
                    initial={{ wornOn: w.wornOn, timeOfDay: w.timeOfDay, rating: w.rating, notes: w.notes ?? '' }}
                    onCancel={() => setEditing(null)}
                    onSave={async (p) => {
                      await api.update(w.id, p);
                      setEditing(null);
                      router.refresh();
                    }}
                    onDelete={async () => {
                      await api.remove(w.id);
                      setEditing(null);
                      router.refresh();
                    }}
                  />
                </div>
              ) : (
                <>
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                    <StarRating value={w.rating} />
                    {w.timeOfDay && <span>{TIME[w.timeOfDay]}</span>}
                  </p>
                  {w.notes && <p className="mt-2 text-[15px] whitespace-pre-line text-ink">{w.notes}</p>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
