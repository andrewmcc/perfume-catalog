'use client';

import { useOptimistic } from 'react';
import { useRouter } from 'next/navigation';
import { OCCASIONS, type Nudge } from '@perfume/core';
import { label } from '@/components/collection/labels';
import { todayHref } from '@/lib/today/href';
import { usePending } from './pending';

type Choice = { nudge: Nudge | null; occasion: string | null };

/** Something lighter / bolder (toggles) and an occasion, carried in the URL. Shows the new choice at once. */
export function Nudges({ nudge, occasion }: { nudge: Nudge | null; occasion: string | null }) {
  const router = useRouter();
  const { startTransition } = usePending();
  const [shown, setShown] = useOptimistic<Choice, Choice>({ nudge, occasion }, (_, next) => next);

  const choose = (next: Choice) =>
    startTransition(() => {
      setShown(next);
      router.push(todayHref(next.nudge, next.occasion), { scroll: false });
    });

  const chip = (n: Nudge, text: string) => {
    const on = shown.nudge === n;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => choose({ ...shown, nudge: on ? null : n })}
        className={`press flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors duration-150 ${on ? 'border-oxblood bg-oxblood text-paper' : 'border-line text-ink'}`}
      >
        {text}
      </button>
    );
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Adjust the picks">
      {chip('lighter', 'Something lighter')}
      {chip('bolder', 'Something bolder')}
      <label className="sr-only" htmlFor="occasion">
        Occasion
      </label>
      <select
        id="occasion"
        value={shown.occasion ?? ''}
        onChange={(e) => choose({ ...shown, occasion: e.target.value || null })}
        className="min-h-11 rounded-full border border-line bg-card px-4 text-sm text-ink"
      >
        <option value="">Any occasion</option>
        {OCCASIONS.map((o) => (
          <option key={o} value={o}>
            {label(o)}
          </option>
        ))}
      </select>
    </div>
  );
}
