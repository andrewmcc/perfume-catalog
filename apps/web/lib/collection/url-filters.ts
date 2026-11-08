import { RATING_OPTIONS, WORN_OPTIONS, type CollectionRow, type Filters } from '@perfume/core';

export type CollectionView = 'owned' | 'sets' | 'wishlist' | 'tried';
type Params = Record<string, string | string[] | undefined>;

const FORMATS = ['full', 'travel', 'decant', 'sample'] as const;
/** What Stats counts as a bottle: any owned format but a sample. */
export const BOTTLE_FORMATS = ['full', 'travel', 'decant'] as const;
const VIEWS: readonly CollectionView[] = ['owned', 'sets', 'wishlist', 'tried'];

const all = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const one = (v: string | string[] | undefined) => all(v)[0];
const known = (v: string | string[] | undefined, allowed: readonly string[]) => all(v).filter((x) => allowed.includes(x));

/** View and filters seeded from the URL, e.g. /collection?format=sample from Stats. Unknown values are ignored. */
export function parseCollectionUrl(sp: Params): { view: CollectionView; filters: Filters } {
  const filters: Filters = {};
  const worn = known(one(sp.worn), WORN_OPTIONS);
  const rating = known(one(sp.rating), RATING_OPTIONS);
  const format = known(sp.format, FORMATS);
  if (worn.length) filters.worn = worn;
  if (rating.length) filters.rating = rating;
  if (format.length) filters.format = format;
  const v = one(sp.view);
  return { view: v && VIEWS.includes(v as CollectionView) ? (v as CollectionView) : 'owned', filters };
}

/** The link that opens the collection on a view and filters. */
export function collectionHref(filters: Filters, view: CollectionView = 'owned'): string {
  const p = new URLSearchParams();
  if (view !== 'owned') p.set('view', view);
  for (const [k, vs] of Object.entries(filters)) for (const v of vs ?? []) p.append(k, v);
  const s = p.toString();
  return s ? `/collection?${s}` : '/collection';
}

/** Items in the shown rows; under a format filter, only items of those formats (so "Bottles" matches its Stats tile). */
export function shownItemCount(rows: CollectionRow[], filters: Filters): number {
  const formats = filters.format?.length ? filters.format : null;
  return rows.reduce((n, r) => n + (formats ? r.items.filter((i) => formats.includes(i.format)).length : r.items.length), 0);
}
