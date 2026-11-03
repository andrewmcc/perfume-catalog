import { monthGrid } from './month.js';

export type YearMonth = { ym: string; weeks: (string | null)[][] };

/** The 12 months of a year as Monday-first weeks; days outside the month are null. */
export function yearGrid(year: number): YearMonth[] {
  return Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { ym, weeks: monthGrid(ym).map((w) => w.map((d) => (d.inMonth ? d.date : null))) };
  });
}

/** Heat step for a day's wear count: 0, 1, 2, 3+. */
export const heatLevel = (n: number): 0 | 1 | 2 | 3 => (n <= 0 ? 0 : n >= 3 ? 3 : (n as 1 | 2));

/** A year the diary can show (2000–2100). */
export const isYear = (s: string | null | undefined): s is string => !!s && /^\d{4}$/.test(s) && +s >= 2000 && +s <= 2100;
