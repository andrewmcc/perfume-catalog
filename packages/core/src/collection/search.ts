import type { CollectionRow } from './row.js';

/** Lowercase without accents, for matching "ebene" to "Ébène". */
export const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Letters and digits only, folded: "D’Orsay", "d'orsay" and "D ORSAY" all become "dorsay"; "&" reads as "and". */
export const searchKey = (s: string) => fold(s).replace(/&/g, 'and').replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Substring search over house, name, notes and accords, ignoring case, accents, punctuation and
 * spacing. "House name" also matches across the two ("d’orsay sweet"). A blank query matches everything.
 */
export function matchesSearch(row: CollectionRow, q: string): boolean {
  const needle = searchKey(q);
  if (!needle) return true;
  const hay = [`${row.house} ${row.name}`, row.name, ...row.notes.top, ...row.notes.heart, ...row.notes.base, ...row.accords];
  return hay.some((h) => searchKey(h).includes(needle));
}
