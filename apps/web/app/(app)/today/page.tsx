import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { reasonLine } from '@perfume/core';
import { ReviewNotice } from '@/components/review/review-notice';
import { ProcessPending } from '@/components/scan/process-pending';
import { WeatherAttribution } from '@/components/today/attribution';
import { contextLine } from '@/components/today/context-line';
import { Nudges } from '@/components/today/nudges';
import { PickCard } from '@/components/today/pick-card';
import { getCurrentCollectionId } from '@/lib/collections/current';
import { createServerClient } from '@/lib/supabase/server';
import { loadToday } from '@/lib/today/load';
import { modelReasons } from '@/lib/today/model-reasons';
import { LoadingFlacon } from '@/components/ui/loading-flacon';

export const metadata: Metadata = { title: 'Today' };

async function Picks({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const supabase = await createServerClient();
  const [collectionId, sp] = await Promise.all([getCurrentCollectionId(supabase), searchParams]);
  if (!collectionId) redirect('/login');
  const t = await loadToday(supabase, sp, new Date());

  if (t.ownedCount === 0)
    return (
      <>
        <p className="text-sm text-muted">{contextLine(t.now, t.weather)}</p>
        <h1 className="mt-1 font-display text-2xl italic">Today</h1>
        <p className="mt-3 text-muted">Nothing on your shelf yet. Scan a bottle from the icon at the top.</p>
      </>
    );

  // Signed thumbnail URLs change per request: keep them out of the cached call's arguments.
  const plain = t.picks.map(({ thumb: _thumb, ...p }) => p);
  const reasons = modelReasons(plain, t.ctx, t.weather?.conditions || null);

  return (
    <>
      <p className="text-sm text-muted">{contextLine(t.now, t.weather)}</p>
      <h1 className="mt-1 font-display text-2xl leading-tight italic">{t.headline.title}</h1>
      <p className="mt-1 text-[15px] text-ink">{t.headline.sub}</p>
      {!t.hasLocation && (
        <Link href="/settings" className="mt-2 inline-block text-sm text-oxblood underline underline-offset-4">
          Set your location for weather-aware picks →
        </Link>
      )}
      <ul className="mt-4 flex flex-col gap-3">
        {t.picks.map((p) => (
          <PickCard key={p.candidate.perfumeId} pick={p} rule={reasonLine(p, t.ctx)} reasons={reasons} collectionId={collectionId} />
        ))}
      </ul>
      <Nudges nudge={t.ctx.nudge} occasion={t.ctx.occasion} />
      {t.hasLocation && <WeatherAttribution />}
    </>
  );
}

export default function Page(props: PageProps<'/today'>) {
  return (
    <>
      <ProcessPending />
      <Suspense>
        <ReviewNotice />
      </Suspense>
      <Suspense fallback={<LoadingFlacon label="Choosing today’s picks…" />}>
        <Picks searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
