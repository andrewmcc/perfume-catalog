/** The perfume fields a member sees and can override (identity house/name stays as matched). */
export const FACT_FIELDS = [
  'concentration',
  'flanker',
  'family',
  'subfamily',
  'accords',
  'notes_top',
  'notes_heart',
  'notes_base',
  'longevity',
  'sillage',
  'seasons',
  'times_of_day',
  'occasions',
  'perfumers',
  'release_year',
] as const;
export type FactField = (typeof FACT_FIELDS)[number];

export type PerfumeFacts = {
  house: string;
  name: string;
  concentration: string | null;
  flanker: string | null;
  family: string | null;
  subfamily: string | null;
  accords: string[];
  notes_top: string[];
  notes_heart: string[];
  notes_base: string[];
  longevity: string | null;
  sillage: string | null;
  seasons: string[];
  times_of_day: string[];
  occasions: string[];
  perfumers: string[];
  release_year: number | null;
  sources: Record<string, string>;
};

export type Source = 'label' | 'ai' | 'edited' | 'text';

const blank = (v: unknown) => v === null || v === undefined || (Array.isArray(v) && v.length === 0);

/** Overrides on top of the perfume, with where each shown value came from (null when there is no value). */
export function effectivePerfume(
  p: PerfumeFacts,
  overrides: Record<string, unknown>,
): { values: Record<FactField, unknown>; source: Record<FactField, Source | null> } {
  const values = {} as Record<FactField, unknown>;
  const source = {} as Record<FactField, Source | null>;
  for (const f of FACT_FIELDS) {
    if (Object.hasOwn(overrides, f)) {
      values[f] = overrides[f];
      source[f] = blank(overrides[f]) ? null : 'edited';
      continue;
    }
    values[f] = p[f] ?? null;
    const s = p.sources[f];
    source[f] = blank(values[f]) ? null : s === 'ai' ? 'ai' : s === 'edited' ? 'edited' : s === 'text' ? 'text' : 'label';
  }
  return { values, source };
}
