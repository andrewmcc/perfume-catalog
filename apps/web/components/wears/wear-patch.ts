import { isDate, type Daypart } from '@perfume/core';

export type WearFormValue = { wornOn: string; timeOfDay: Daypart | null; rating: number | null; notes: string };
export type WearPatch = { worn_on: string; time_of_day: Daypart | null; rating: number | null; notes: string | null };

export const NOTES_MAX = 2000;

/** The columns a wear form may write. Throws a user-facing message when the form is invalid. */
export function wearPatch(f: WearFormValue, today?: string): WearPatch {
  if (!isDate(f.wornOn)) throw new Error('Pick a date.');
  if (today && f.wornOn > today) throw new Error('A wear can’t be in the future.');
  if (f.rating != null && !(Number.isInteger(f.rating) && f.rating >= 1 && f.rating <= 5)) throw new Error('A rating is 1 to 5 stars.');
  const notes = f.notes.trim();
  if (notes.length > NOTES_MAX) throw new Error(`Notes are too long (${notes.length} of ${NOTES_MAX} characters).`);
  return { worn_on: f.wornOn, time_of_day: f.timeOfDay, rating: f.rating, notes: notes || null };
}
