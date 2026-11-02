import { addDays } from '../time/london.js';

export type GridDay = { date: string; inMonth: boolean };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Monday-first weeks covering the month (YYYY-MM), padded with neighbouring days. */
export function monthGrid(ym: string): GridDay[][] {
  const [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`;
  const mondayOffset = (new Date(Date.UTC(y!, m! - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const weeks = Math.ceil((mondayOffset + daysInMonth) / 7);
  const start = addDays(first, -mondayOffset);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      return { date, inMonth: date.startsWith(ym) };
    }),
  );
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const idx = y! * 12 + (m! - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m! - 1]} ${y}`;
}

/** True for a well-formed YYYY-MM. */
export const isMonth = (s: string | null | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
/** True for a well-formed YYYY-MM-DD that is a real date. */
export const isDate = (s: string | null | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
