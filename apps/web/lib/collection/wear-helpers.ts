import type { Daypart } from '@perfume/core';

/** The item a "Wear today" logs against: an owned non-sample item, else any owned item. */
export function wearItemFor(items: { id: string; status: string; format: string }[]): string | null {
  const owned = items.filter((i) => i.status === 'owned');
  return (owned.find((i) => i.format !== 'sample') ?? owned[0])?.id ?? null;
}

export type WearNote = { id: string; wornOn: string; rating: number | null; notes: string | null; timeOfDay: Daypart | null };
type Row = { id: string; worn_on: string; rating: number | null; notes: string | null; time_of_day: string | null; created_at: string };

/** Wears with notes or a rating, newest first. */
export function notesOf(wears: Row[]): WearNote[] {
  return wears
    .filter((w) => w.rating != null || (w.notes ?? '').trim() !== '')
    .sort((a, b) => b.worn_on.localeCompare(a.worn_on) || b.created_at.localeCompare(a.created_at))
    .map((w) => ({ id: w.id, wornOn: w.worn_on, rating: w.rating, notes: w.notes, timeOfDay: w.time_of_day as Daypart | null }));
}
