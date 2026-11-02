import type { CollectionRow } from './row.js';

/** Lowercase without accents, for matching "ebene" to "Ébène". */
export const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Substring search over house, name, notes and accords. A blank query matches everything. */
export function matchesSearch(row: CollectionRow, q: string): boolean {
  const needle = fold(q.trim());
  if (!needle) return true;
  const hay = [row.house, row.name, ...row.notes.top, ...row.notes.heart, ...row.notes.base, ...row.accords];
  return hay.some((h) => fold(h).includes(needle));
}
