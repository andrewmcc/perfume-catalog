import { idealHeft, type Pick, type ReasonCode, type TodayContext } from './score.js';

const OCCASION_COPY: Record<string, string> = {
  office: 'the office',
  casual: 'a casual day',
  date: 'a date',
  evening_out: 'an evening out',
  formal: 'a formal do',
  gym: 'the gym',
  holiday: 'a holiday',
};
const DAYPART_COPY = { day: 'A daytime scent', evening: 'An evening scent', night: 'One for the night' } as const;

export function reasonText(r: ReasonCode, ctx: TodayContext): string {
  switch (r.code) {
    case 'untried_sample':
      return 'Untried sample';
    case 'neglected':
      return `Not worn in ${r.weeks} weeks`;
    case 'season':
      return `Made for ${ctx.season}`;
    case 'daypart':
      return DAYPART_COPY[ctx.daypart];
    case 'occasion':
      return `Good for ${ctx.occasion ? (OCCASION_COPY[ctx.occasion] ?? ctx.occasion.replace('_', ' ')) : 'today'}`;
    case 'heavy':
      return 'Warm and heavy';
    case 'fresh':
      return 'Fresh and light';
    case 'weather_fit':
      return `Right for ${Math.round(ctx.tempC ?? 0)}°C`;
  }
}

/** The pick's rule reason: its two strongest phrases. */
export function reasonLine(p: Pick, ctx: TodayContext): string {
  const phrases = p.reasons.slice(0, 2).map((r) => reasonText(r, ctx));
  return phrases.length ? phrases.join(' · ') : 'A change of pace';
}

const TITLE: Record<number, string> = { 2: 'something with presence', 1: 'something warm', 0: 'something easy', [-1]: 'something fresh', [-2]: 'something light and bright' };
const MOOD: Record<number, string> = { 2: 'base-heavy and bold', 1: 'warm and rounded', 0: 'anything goes', [-1]: 'fresh and easy', [-2]: 'light and bright' };
const WHEN = { day: 'Today', evening: 'This evening', night: 'Tonight' } as const;
const NOUN = { day: 'day', evening: 'evening', night: 'night' } as const;
const tempWord = (t: number) => (t < 4 ? 'Cold' : t < 10 ? 'Chilly' : t < 16 ? 'Mild' : t < 22 ? 'Warm' : 'Hot');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function headline(ctx: TodayContext): { title: string; sub: string } {
  const ideal = idealHeft(ctx);
  const lead = ctx.tempC != null ? tempWord(Math.round(ctx.tempC)) : cap(ctx.season);
  return { title: `${WHEN[ctx.daypart]}, ${TITLE[ideal]}`, sub: `${lead} ${NOUN[ctx.daypart]}, so ${MOOD[ideal]}.` };
}
