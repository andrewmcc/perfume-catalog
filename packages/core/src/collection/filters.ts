import type { CollectionRow } from './row.js';

export type Filters = Partial<Record<'family' | 'season' | 'time' | 'occasion' | 'house' | 'format' | 'set', string[]>>;
export type FilterKey = keyof Filters;

const valuesOf: Record<FilterKey, (r: CollectionRow) => string[]> = {
  family: (r) => (r.family ? [r.family] : []),
  season: (r) => r.seasons,
  time: (r) => r.times,
  occasion: (r) => r.occasions,
  house: (r) => [r.house],
  format: (r) => r.items.map((i) => i.format),
  set: (r) => r.items.flatMap((i) => (i.setId ? [i.setId] : [])),
};

/** AND across keys, OR within a key. Empty or missing keys don't filter. */
export function applyFilters(rows: CollectionRow[], f: Filters): CollectionRow[] {
  const active = (Object.entries(f) as [FilterKey, string[] | undefined][]).filter(([, v]) => v && v.length > 0) as [FilterKey, string[]][];
  return rows.filter((r) => active.every(([k, want]) => valuesOf[k](r).some((v) => want.includes(v))));
}

const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));

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
  };
}
