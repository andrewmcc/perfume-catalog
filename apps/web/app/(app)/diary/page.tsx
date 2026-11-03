import type { Metadata } from 'next';
import { connection } from 'next/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { isDate, isMonth, isYear, londonNow, monthLabel } from '@perfume/core';
import { DayEntries } from '@/components/diary/day-entries';
import { MonthView } from '@/components/diary/month-view';
import { ViewToggle } from '@/components/diary/view-toggle';
import { YearView } from '@/components/diary/year-view';
import { LogWearSheet } from '@/components/wears/log-wear-sheet';
import { getCurrentCollectionId } from '@/lib/collections/current';
import { createServerClient } from '@/lib/supabase/server';
import { loadMonth, loadWearables, loadYearCounts } from '@/lib/wears/load';
import { LoadingFlacon } from '@/components/ui/loading-flacon';

export const metadata: Metadata = { title: 'Diary' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Diary({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const sp = await searchParams;
  const today = londonNow(new Date()).date;
  const y = one(sp.y);
  if (isYear(y)) {
    const counts = await loadYearCounts(await createServerClient(), Number(y));
    const ym = y === today.slice(0, 4) ? today.slice(0, 7) : `${y}-01`;
    return (
      <>
        <ViewToggle view="year" monthHref={`/diary?m=${ym}`} yearHref={`/diary?y=${y}`} />
        <YearView year={Number(y)} counts={counts} today={today} />
      </>
    );
  }
  const d = one(sp.d);
  const m = one(sp.m);
  const ym = isMonth(m) ? m : isDate(d) ? d.slice(0, 7) : today.slice(0, 7);
  const selected = isDate(d) && d.startsWith(ym) ? d : today.startsWith(ym) ? today : null;

  const supabase = await createServerClient();
  const collectionId = await getCurrentCollectionId(supabase);
  if (!collectionId) redirect('/login');
  const [wears, wearables] = await Promise.all([loadMonth(supabase, ym), loadWearables(supabase)]);

  return (
    <>
      <ViewToggle view="month" monthHref={`/diary?m=${ym}`} yearHref={`/diary?y=${ym.slice(0, 4)}`} />
      <MonthView ym={ym} wears={wears} selected={selected} today={today} />
      {wears.length === 0 && <p className="mt-3 text-sm text-muted">No wears logged in {monthLabel(ym).split(' ')[0]}.</p>}
      <div className="mt-4">
        <LogWearSheet wearables={wearables} collectionId={collectionId} defaultDate={selected ?? today} />
      </div>
      {selected && <DayEntries key={selected} date={selected} wears={wears.filter((w) => w.wornOn === selected)} collectionId={collectionId} />}
    </>
  );
}

export default function Page(props: PageProps<'/diary'>) {
  return (
    <>
      <h1 className="sr-only">Diary</h1>
      <Suspense fallback={<LoadingFlacon label="Turning the pages…" />}>
        <Diary searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
