import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { findGaps, formatAvg, formatGbp } from '@perfume/core';
import { Breakdown } from '@/components/stats/breakdown';
import { GapCard } from '@/components/stats/gap-card';
import { loadCollection } from '@/lib/collection/load';
import { BOTTLE_FORMATS, collectionHref } from '@/lib/collection/url-filters';
import { loadStats } from '@/lib/stats/load';
import { createServerClient } from '@/lib/supabase/server';
import { LoadingFlacon } from '@/components/ui/loading-flacon';

export const metadata: Metadata = { title: 'Stats' };

/** A headline number; tapping it opens the collection showing what it counts. */
function Tile({ value, label, note, href }: { value: string; label: string; note?: string; href: string }) {
  return (
    <Link href={href} className="label-card flex flex-col items-center justify-center px-2 py-3 text-center hover:border-oxblood">
      <span className="font-display text-3xl leading-none text-ink">{value}</span>
      <span className="mt-1 text-[12px] tracking-[0.12em] text-muted uppercase">{label}</span>
      {note && <span className="mt-0.5 text-[11px] text-muted">{note}</span>}
    </Link>
  );
}

async function Stats() {
  await connection();
  const supabase = await createServerClient();
  const [s, { rows }] = await Promise.all([loadStats(supabase), loadCollection(supabase, { thumbs: false })]);
  const gaps = findGaps(rows.filter((r) => r.items.some((i) => i.status === 'owned')));
  const empty = s.bottles + s.samples === 0;
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Tile value={String(s.bottles)} label={s.bottles === 1 ? 'bottle' : 'bottles'} href={collectionHref({ format: [...BOTTLE_FORMATS] })} />
        <Tile value={String(s.samples)} label={s.samples === 1 ? 'sample' : 'samples'} href={collectionHref({ format: ['sample'] })} />
        <Tile value={String(s.sets)} label={s.sets === 1 ? 'set' : 'sets'} href={collectionHref({}, 'sets')} />
        <Tile value={formatGbp(s.value.total)} label="est. value" note={s.value.unpriced ? `${s.value.unpriced} without a price` : undefined} href={collectionHref({})} />
      </div>
      <p className="mt-2 text-[12px] text-muted">Value is an estimate: what you paid where entered, otherwise typical retail price for the size.</p>
      {empty ? (
        <p className="mt-4 text-muted">The rest of your stats appear once your shelf has something on it.</p>
      ) : (
        <>

      {gaps.length > 0 && (
        <section aria-label="Gaps in your shelf" className="mt-4">
          <h2 className="font-display text-lg italic">Gaps in your shelf</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {gaps.map((g) => (
              <GapCard key={g.id} gap={g} />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Worn vs neglected" className="label-card mt-4 p-4">
        <h2 className="font-display text-lg italic">Worn vs neglected</h2>
        <p className="mt-1 text-[15px] text-ink">
          <span className="font-display text-2xl">{s.neglected}</span> not worn in 3 months
          {s.neglected > 0 && (
            <>
              {' · '}
              <Link href="/collection?worn=neglected" className="text-oxblood underline underline-offset-4">
                see them
              </Link>
            </>
          )}
        </p>
        {s.mostWorn && (
          <p className="mt-2 text-sm text-ink">
            Most worn:{' '}
            <Link href={`/collection/${s.mostWorn.perfumeId}`} className="underline underline-offset-4">
              {s.mostWorn.name}
            </Link>{' '}
            ({s.mostWorn.count}×)
          </p>
        )}
        {s.topRated && (
          <p className="mt-1 text-sm text-ink">
            Highest rated:{' '}
            <Link href={`/collection/${s.topRated.perfumeId}`} className="underline underline-offset-4">
              {s.topRated.name}
            </Link>{' '}
            (★{formatAvg(s.topRated.avg)})
          </p>
        )}
      </section>

      <div className="mt-4 flex flex-col gap-4">
        <Breakdown title="By scent family" rows={s.byFamily} swatch />
        <Breakdown title="By season" rows={s.bySeason} />
        <Breakdown title="By house" rows={s.byHouse} raw />
        <Breakdown title="By format" rows={s.byFormat} />
      </div>
        </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <>
      <h1 className="font-display text-2xl italic">Stats</h1>
      <Suspense fallback={<LoadingFlacon label="Counting bottles…" />}>
        <Stats />
      </Suspense>
    </>
  );
}
