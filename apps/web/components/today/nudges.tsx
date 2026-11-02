'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OCCASIONS, type Nudge } from '@perfume/core';
import { label } from '@/components/collection/labels';

const href = (n: Nudge | null, o: string | null) => {
  const q = new URLSearchParams();
  if (n) q.set('n', n);
  if (o) q.set('o', o);
  const s = q.toString();
  return s ? `/today?${s}` : '/today';
};

/** Something lighter / bolder (toggles) and an occasion, carried in the URL. */
export function Nudges({ nudge, occasion }: { nudge: Nudge | null; occasion: string | null }) {
  const router = useRouter();
  const chip = (n: Nudge, text: string) => (
    <Link
      href={href(nudge === n ? null : n, occasion)}
      aria-pressed={nudge === n}
      scroll={false}
      className={`flex min-h-11 items-center rounded-full border px-4 text-sm ${nudge === n ? 'border-oxblood bg-oxblood text-paper' : 'border-line text-ink'}`}
    >
      {text}
    </Link>
  );
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Adjust the picks">
      {chip('lighter', 'Something lighter')}
      {chip('bolder', 'Something bolder')}
      <label className="sr-only" htmlFor="occasion">
        Occasion
      </label>
      <select
        id="occasion"
        value={occasion ?? ''}
        onChange={(e) => router.push(href(nudge, e.target.value || null), { scroll: false })}
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
