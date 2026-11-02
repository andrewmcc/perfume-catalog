'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { applyFilters, filterOptions, londonNow, matchesSearch, type CollectionRow, type Filters } from '@perfume/core';
import type { SetRow } from '@/lib/collection/load';
import { FilterSheet } from './filter-sheet';
import { PerfumeRow } from './perfume-row';
import { ViewSwitch, type View } from './view-switch';

export function CollectionView({ rows, sets }: { rows: CollectionRow[]; sets: SetRow[] }) {
  const [view, setView] = useState<View>('owned');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [sheet, setSheet] = useState(false);

  const status = view === 'wishlist' ? 'wishlist' : 'owned';
  const inView = useMemo(
    () => rows.map((r) => ({ ...r, items: r.items.filter((i) => i.status === status) })).filter((r) => r.items.length > 0),
    [rows, status],
  );
  const options = useMemo(() => filterOptions(inView), [inView]);
  const shown = applyFilters(inView, filters, londonNow(new Date()).date).filter((r) => matchesSearch(r, q));
  const active = Object.values(filters).reduce((n, v) => n + (v?.length ?? 0), 0);
  const itemCount = inView.reduce((n, r) => n + r.items.length, 0);

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl italic">Collection</h1>
        {view !== 'sets' && itemCount > 0 && <p className="text-sm text-muted">{itemCount === 1 ? '1 item' : `${itemCount} items`}</p>}
      </div>
      <div className="mt-4">
        <ViewSwitch view={view} onChange={setView} />
      </div>

      {view === 'sets' ? (
        sets.length === 0 ? (
          <p className="mt-6 text-muted">No sets yet. Scan a discovery set in Set mode and its samples arrive together.</p>
        ) : (
          <ul className="label-card mt-4 px-4">
            {sets.map((s) => (
              <li key={s.id} className="border-b border-line-soft last:border-0">
                <Link href={`/collection/sets/${s.id}`} className="flex items-center gap-3 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {s.thumb ? <img src={s.thumb} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-[3px] object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-[3px] bg-line-soft" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] tracking-[0.14em] text-muted uppercase">{s.house ?? 'Discovery set'}</p>
                    <p className="font-display text-[18px] leading-snug text-ink">{s.name ?? 'Unnamed set'}</p>
                    <p className="text-[13px] text-muted">{s.count === 1 ? '1 sample' : `${s.count} samples`}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : inView.length === 0 ? (
        <p className="mt-6 text-muted">
          {view === 'wishlist' ? 'Your wishlist is empty. Adding to it arrives in a later update.' : 'Nothing here yet. Scan a bottle from the icon at the top, then approve it in Review.'}
        </p>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search house, name, notes"
              aria-label="Search"
              className="min-h-11 min-w-0 flex-1 rounded-[3px] border border-line bg-card px-3 text-[16px] text-ink placeholder:text-muted/70 focus:border-oxblood focus:outline-none"
            />
            <button onClick={() => setSheet(true)} className="min-h-11 shrink-0 rounded-[3px] border border-oxblood px-3 text-sm text-oxblood">
              Filters{active > 0 ? ` (${active})` : ''}
            </button>
          </div>
          {shown.length === 0 ? (
            <p className="mt-6 text-muted">Nothing matches. Try fewer filters or another word.</p>
          ) : (
            <ul className="label-card mt-4 px-4">
              {shown.map((r) => (
                <PerfumeRow key={r.perfumeId} row={r} items={r.items} />
              ))}
            </ul>
          )}
        </>
      )}
      {sheet && <FilterSheet options={options} filters={filters} onChange={setFilters} onClose={() => setSheet(false)} />}
    </>
  );
}
