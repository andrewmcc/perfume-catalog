import type { Weight } from './pyramid.js';

export type CollectionItem = { id: string; format: string; size_ml: number | null; status: string; setId: string | null; setName: string | null };

/** One perfume in the collection list, with its items (grouped). */
export type CollectionRow = {
  perfumeId: string;
  house: string;
  name: string;
  concentration: string | null;
  family: string | null;
  seasons: string[];
  times: string[];
  occasions: string[];
  accords: string[];
  notes: { top: string[]; heart: string[]; base: string[] };
  weight: Weight | null;
  thumb: string | null;
  items: CollectionItem[];
  /** This collection's wears of the perfume. */
  wear: { count: number; avgRating: number | null; lastWorn: string | null };
};
