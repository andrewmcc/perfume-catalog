import type { Nudge, TodayContext } from '@perfume/core';

/** Today's URL for a nudge and an occasion. */
export function todayHref(n: Nudge | null, o: string | null): string {
  const q = new URLSearchParams();
  if (n) q.set('n', n);
  if (o) q.set('o', o);
  const s = q.toString();
  return s ? `/today?${s}` : '/today';
}

/** Changes whenever the picks' context does; keys boundaries that must not hold the old screen. */
export const todayKey = (c: TodayContext) => [c.date, c.daypart, c.nudge ?? '', c.occasion ?? '', c.tempC ?? ''].join('|');
