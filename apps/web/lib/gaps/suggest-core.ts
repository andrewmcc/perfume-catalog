import { findGaps, type CollectionRow, type Gap, type GapId, type GapSuggestion } from '@perfume/core';

export class QuotaError extends Error {}

type Named = { house: string; name: string };
export type SuggestDeps = { claim: () => Promise<boolean>; suggest: (gap: Gap, owned: Named[]) => Promise<GapSuggestion[]> };

/** Claims a gap_suggest call, then asks the model. Throws QuotaError when the day's calls are used. */
export async function suggestFor(gap: Gap, owned: Named[], deps: SuggestDeps): Promise<GapSuggestion[]> {
  if (!(await deps.claim())) throw new QuotaError('gap suggestions quota used up');
  return deps.suggest(gap, owned);
}

/** The gap as it stands in the owned perfumes, or null when the collection doesn't have it now. */
export function currentGap(rows: CollectionRow[], id: GapId): Gap | null {
  return findGaps(rows.filter((r) => r.items.some((i) => i.status === 'owned'))).find((g) => g.id === id) ?? null;
}
