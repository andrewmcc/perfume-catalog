import { RECENT_DAYS } from '../collection/filters.js';
import { wearSummary, type WearLite } from '../diary/summary.js';
import { daysBetween } from '../time/london.js';

export type StatItem = {
  perfumeId: string;
  house: string;
  name: string;
  family: string | null;
  seasons: string[];
  format: string;
  status: string;
  sizeMl: number | null;
  price: number | null;
  typicalPerMl: number | null;
};
export type Count = { key: string; count: number };
export type CollectionStats = {
  bottles: number;
  samples: number;
  sets: number;
  value: { total: number; unpriced: number };
  byFamily: Count[];
  bySeason: Count[];
  byHouse: Count[];
  byFormat: Count[];
  neglected: number;
  mostWorn: { perfumeId: string; house: string; name: string; count: number } | null;
  topRated: { perfumeId: string; house: string; name: string; avg: number } | null;
};

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
const HOUSES_SHOWN = 8;

/** Largest first; ties keep first-seen order; `last` (e.g. "unknown") always goes last. */
function tally(keys: string[], last?: string): Count[] {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => Number(a.key === last) - Number(b.key === last) || b.count - a.count);
}

/** Shelf totals, estimated value, breakdowns, neglect and favourites. Only owned items count. */
export function collectionStats(items: StatItem[], wears: WearLite[], setCount: number, today: string): CollectionStats {
  const owned = items.filter((i) => i.status === 'owned');
  const perfumes = [...new Map(owned.map((i) => [i.perfumeId, i])).values()];

  let total = 0;
  let unpriced = 0;
  for (const i of owned) {
    if (i.price != null) total += i.price;
    else if (i.typicalPerMl != null && i.sizeMl != null) total += i.typicalPerMl * i.sizeMl;
    else unpriced++;
  }

  const houses = tally(perfumes.map((p) => p.house));
  const byHouse = houses.length > HOUSES_SHOWN + 1 ? [...houses.slice(0, HOUSES_SHOWN), { key: 'Other', count: houses.slice(HOUSES_SHOWN).reduce((n, h) => n + h.count, 0) }] : houses;

  const ownedIds = new Set(perfumes.map((p) => p.perfumeId));
  const summary = wearSummary(wears.filter((w) => ownedIds.has(w.perfumeId)));
  const neglected = perfumes.filter((p) => {
    const last = summary.get(p.perfumeId)?.lastWorn;
    return !last || daysBetween(last, today) > RECENT_DAYS;
  }).length;

  const named = (id: string) => {
    const p = perfumes.find((x) => x.perfumeId === id)!;
    return { perfumeId: id, house: p.house, name: p.name };
  };
  const ranked = [...summary];
  const most = ranked.sort((a, b) => b[1].count - a[1].count)[0];
  const rated = ranked.filter(([, s]) => s.ratedCount >= 2 && s.avgRating != null).sort((a, b) => b[1].avgRating! - a[1].avgRating! || b[1].ratedCount - a[1].ratedCount)[0];

  return {
    bottles: owned.filter((i) => i.format !== 'sample').length,
    samples: owned.filter((i) => i.format === 'sample').length,
    sets: setCount,
    value: { total: Math.round(total), unpriced },
    byFamily: tally(perfumes.map((p) => p.family ?? 'unknown'), 'unknown'),
    bySeason: SEASON_ORDER.map((key) => ({ key, count: perfumes.filter((p) => p.seasons.includes(key)).length })),
    byHouse,
    byFormat: tally(owned.map((i) => i.format)),
    neglected,
    mostWorn: most ? { ...named(most[0]), count: most[1].count } : null,
    topRated: rated ? { ...named(rated[0]), avg: rated[1].avgRating! } : null,
  };
}

/** £840, £3.2k. */
export function formatGbp(n: number): string {
  const r = Math.round(n);
  return r >= 1000 ? `£${(r / 1000).toFixed(1)}k` : `£${r}`;
}
