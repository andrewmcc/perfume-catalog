import { daysBetween } from '../time/london.js';
import type { CollectionRow } from './row.js';

type ValueKey = 'family' | 'season' | 'time' | 'occasion' | 'house' | 'format' | 'set';
export type Filters = Partial<Record<ValueKey | 'rating' | 'worn', string[]>>;
export type FilterKey = keyof Filters;

/** "Recently worn" window, in days. */
export const RECENT_DAYS = 90;

const valuesOf: Record<ValueKey, (r: CollectionRow) => string[]> = {
  family: (r) => (r.family ? [r.family] : []),
  season: (r) => r.seasons,
  time: (r) => r.times,
  occasion: (r) => r.occasions,
  house: (r) => [r.house],
  format: (r) => r.items.map((i) => i.format),
  set: (r) => r.items.flatMap((i) => (i.setId ? [i.setId] : [])),
};

const isRecent = (r: CollectionRow, today: string) => r.wear.lastWorn != null && daysBetween(r.wear.lastWorn, today) <= RECENT_DAYS;

/** Does the row match one value of a key? */
function matches(k: FilterKey, v: string, r: CollectionRow, today: string): boolean {
  if (k === 'rating') return r.wear.avgRating != null && r.wear.avgRating >= Number(v);
  if (k === 'worn') return v === 'recent' ? isRecent(r, today) : !isRecent(r, today);
  return valuesOf[k](r).includes(v);
}

/** AND across keys, OR within a key. Empty or missing keys don't filter. `today` is a London date. */
export function applyFilters(rows: CollectionRow[], f: Filters, today: string): CollectionRow[] {
  const active = (Object.entries(f) as [FilterKey, string[] | undefined][]).filter(([, v]) => v && v.length > 0) as [FilterKey, string[]][];
  return rows.filter((r) => active.every(([k, want]) => want.some((v) => matches(k, v, r, today))));
}

const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
export const RATING_OPTIONS = ['4', '3'] as const;
export const WORN_OPTIONS = ['recent', 'neglected'] as const;

/** The values present in the rows, for the filter sheet. Sets come as id + name. */
export function filterOptions(rows: CollectionRow[]): Omit<Record<FilterKey, string[]>, 'set'> & { set: { id: string; name: string }[] } {
  const sets = new Map<string, string>();
  for (const r of rows) for (const i of r.items) if (i.setId) sets.set(i.setId, i.setName ?? 'Unnamed set');
  return {
    family: sorted(rows.flatMap(valuesOf.family)),
    season: sorted(rows.flatMap(valuesOf.season)),
    time: sorted(rows.flatMap(valuesOf.time)),
    occasion: sorted(rows.flatMap(valuesOf.occasion)),
    house: sorted(rows.flatMap(valuesOf.house)),
    format: sorted(rows.flatMap(valuesOf.format)),
    set: [...sets].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    rating: RATING_OPTIONS.filter((n) => rows.some((r) => r.wear.avgRating != null && r.wear.avgRating >= Number(n))),
    worn: rows.length ? [...WORN_OPTIONS] : [],
  };
}
