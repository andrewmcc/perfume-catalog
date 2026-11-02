export type Daypart = 'day' | 'evening' | 'night';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type SeasonPhase = 'early' | 'mid' | 'late';

export type LondonNow = {
  date: string; // YYYY-MM-DD, London calendar date
  hour: number;
  minute: number;
  weekday: string; // Monday…Sunday
  daypart: Daypart;
  season: Season;
  phase: SeasonPhase;
};

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'long',
  hourCycle: 'h23',
});

/** day 05:00–16:59, evening 17:00–21:59, night 22:00–04:59. */
export function daypartOf(hour: number): Daypart {
  if (hour >= 5 && hour < 17) return 'day';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

const SEASON_OF_MONTH: [Season, SeasonPhase][] = [
  ['winter', 'mid'], // Jan
  ['winter', 'late'],
  ['spring', 'early'],
  ['spring', 'mid'],
  ['spring', 'late'],
  ['summer', 'early'],
  ['summer', 'mid'],
  ['summer', 'late'],
  ['autumn', 'early'],
  ['autumn', 'mid'],
  ['autumn', 'late'],
  ['winter', 'early'], // Dec
];

/** Northern-hemisphere meteorological season for a month (1–12). */
export function seasonOf(month: number): { season: Season; phase: SeasonPhase } {
  const [season, phase] = SEASON_OF_MONTH[month - 1]!;
  return { season, phase };
}

export function londonNow(now: Date): LondonNow {
  const p = Object.fromEntries(parts.formatToParts(now).map((x) => [x.type, x.value]));
  const month = Number(p.month);
  const hour = Number(p.hour);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour,
    minute: Number(p.minute),
    weekday: p.weekday!,
    daypart: daypartOf(hour),
    ...seasonOf(month),
  };
}

const toUtc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
};
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Calendar-date arithmetic on YYYY-MM-DD (no time zone involved). */
export const addDays = (date: string, n: number): string => fromUtc(toUtc(date) + n * 86_400_000);

/** Whole calendar days from a to b (b − a). */
export const daysBetween = (a: string, b: string): number => Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
