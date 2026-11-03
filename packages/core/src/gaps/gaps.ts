import type { CollectionRow } from '../collection/row.js';
import { heft } from '../today/score.js';

export type GapId = 'hot_days' | 'cold_days' | 'date_night' | 'office' | 'spring';
export type Gap = { id: GapId; title: string; count: number; total: number };

type Rule = { id: GapId; title: string; wish: string; fits: (r: CollectionRow) => boolean };

const has = (xs: string[], ...ys: string[]) => ys.some((y) => xs.includes(y));
const weightOf = (r: CollectionRow) => heft({ family: r.family, weight: r.weight, sillage: r.sillage });

/** In display order; a perfume can fill several. */
export const GAP_RULES: readonly Rule[] = [
  {
    id: 'hot_days',
    title: 'Nothing fresh or aquatic for hot days',
    wish: 'Fills your hot-days gap',
    fits: (r) => (has([r.family ?? ''], 'citrus', 'aquatic', 'green') || weightOf(r) <= -1) && (!r.seasons.length || r.seasons.includes('summer')),
  },
  { id: 'cold_days', title: 'Nothing warm for cold days', wish: 'Fills your cold-days gap', fits: (r) => weightOf(r) >= 1 && (!r.seasons.length || r.seasons.includes('winter')) },
  { id: 'date_night', title: 'Nothing for a date or an evening out', wish: 'Fills your date-night gap', fits: (r) => has(r.occasions, 'date', 'evening_out') },
  { id: 'office', title: 'Nothing quiet enough for the office', wish: 'Fills your office gap', fits: (r) => r.occasions.includes('office') && !has([r.sillage ?? ''], 'strong', 'enormous') },
  { id: 'spring', title: 'Nothing bright for spring', wish: 'Fills your spring gap', fits: (r) => r.seasons.includes('spring') && has([r.family ?? ''], 'floral', 'green', 'citrus', 'fruity') },
];

export const GAP_MIN_OWNED = 5;
export const GAP_BELOW = 2;
export const MAX_GAPS = 3;

export const isGapId = (s: string): s is GapId => GAP_RULES.some((r) => r.id === s);
export const gapRule = (id: GapId) => GAP_RULES.find((r) => r.id === id)!;
export const gapWishReason = (id: GapId) => gapRule(id).wish;

/** Gaps in the owned perfumes (rows already filtered to owned): fewest first, at most 3. */
export function findGaps(owned: CollectionRow[]): Gap[] {
  const total = owned.length;
  if (total < GAP_MIN_OWNED) return [];
  return GAP_RULES.map((rule, i) => ({ i, gap: { id: rule.id, title: rule.title, count: owned.filter(rule.fits).length, total } }))
    .filter(({ gap }) => gap.count < GAP_BELOW)
    .sort((a, b) => a.gap.count - b.gap.count || a.i - b.i)
    .slice(0, MAX_GAPS)
    .map(({ gap }) => gap);
}
