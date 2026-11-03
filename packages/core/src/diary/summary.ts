export type WearLite = { id: string; perfumeId: string; wornOn: string; rating: number | null };
export type WearStats = { count: number; avgRating: number | null; ratedCount: number; lastWorn: string | null };

export const NO_WEARS: WearStats = { count: 0, avgRating: null, ratedCount: 0, lastWorn: null };

/** Per-perfume wear count, average rating (rated wears only, one decimal) and last worn date. */
export function wearSummary(wears: WearLite[]): Map<string, WearStats> {
  const acc = new Map<string, { count: number; sum: number; rated: number; last: string | null }>();
  for (const w of wears) {
    const a = acc.get(w.perfumeId) ?? { count: 0, sum: 0, rated: 0, last: null };
    a.count++;
    if (w.rating != null) {
      a.sum += w.rating;
      a.rated++;
    }
    if (!a.last || w.wornOn > a.last) a.last = w.wornOn;
    acc.set(w.perfumeId, a);
  }
  return new Map(
    [...acc].map(([id, a]) => [id, { count: a.count, avgRating: a.rated ? a.sum / a.rated : null, ratedCount: a.rated, lastWorn: a.last }]),
  );
}

/** An average rating for display: one decimal, rounded down (3.95 → "3.9", so it never shows a star it hasn't earned); "4", not "4.0". */
export const formatAvg = (n: number): string => (Math.floor(n * 10 + 1e-9) / 10).toFixed(1).replace(/\.0$/, '');
