import { OCCASIONS, SEASONS, TIMES_OF_DAY, type RawSuggestion } from './schema.js';

type Blank<T> = { [K in keyof T]: T[K] extends string ? Exclude<T[K], ''> | null : T[K] extends number ? number | null : T[K] };
export type PerfumeSuggestion = Omit<Blank<RawSuggestion>, 'discontinued'> & { discontinued: boolean | null };

const list = (xs: string[], lower = false) => [...new Set(xs.map((x) => (lower ? x.trim().toLowerCase() : x.trim())).filter(Boolean))];
const only = <T extends string>(xs: readonly string[], vocab: readonly T[]) => [...new Set(xs.filter((x): x is T => (vocab as readonly string[]).includes(x)))];
const text = <T extends string>(v: T | ''): T | null => (v === '' ? null : (v as T));

/** Sentinels to null; lists trimmed, deduped and confined to the vocabularies. */
export function normalizeSuggestion(r: RawSuggestion): PerfumeSuggestion {
  return {
    perfumers: list(r.perfumers),
    release_year: r.release_year > 0 ? r.release_year : null,
    house_type: text(r.house_type),
    family: text(r.family),
    subfamily: r.subfamily.trim() || null,
    accords: list(r.accords, true).slice(0, 6),
    notes_top: list(r.notes_top, true),
    notes_heart: list(r.notes_heart, true),
    notes_base: list(r.notes_base, true),
    longevity: text(r.longevity),
    sillage: text(r.sillage),
    seasons: only(r.seasons, SEASONS),
    times_of_day: only(r.times_of_day, TIMES_OF_DAY),
    occasions: only(r.occasions, OCCASIONS),
    gender_marketing: text(r.gender_marketing),
    discontinued: r.discontinued === 'unknown' ? null : r.discontinued === 'yes',
    typical_price_per_ml: r.typical_price_per_ml > 0 ? Math.round(r.typical_price_per_ml * 100) / 100 : null,
  };
}

const empty = (v: unknown) => v === null || v === undefined || (Array.isArray(v) && v.length === 0);

/** Fills only fields that are null or empty, marking each filled field 'ai'. Never overwrites. */
export function fillMissing(
  current: Record<string, unknown> & { sources: Record<string, string> },
  s: PerfumeSuggestion,
): { update: Record<string, unknown>; sources: Record<string, string> } {
  const update: Record<string, unknown> = {};
  const sources = { ...current.sources };
  for (const [k, v] of Object.entries(s)) {
    if (empty(v) || !empty(current[k])) continue;
    update[k] = v;
    sources[k] = 'ai';
  }
  return { update, sources };
}
