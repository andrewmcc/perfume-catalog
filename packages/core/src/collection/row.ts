import { formatAvg } from '../diary/summary.js';
import type { Weight } from './pyramid.js';

export type CollectionItem = { id: string; format: string; size_ml: number | null; status: string; setId: string | null; setName: string | null; wishReason?: string | null; notes?: string | null };

/** One perfume in the collection list, with its items (grouped). */
export type CollectionRow = {
  perfumeId: string;
  house: string;
  name: string;
  concentration: string | null;
  family: string | null;
  sillage: string | null;
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

/** The line under a wishlist row: its stored reason, else a loved sample, else "Added by you". */
export function wishLine(r: CollectionRow): string {
  const stored = r.items.find((i) => i.wishReason)?.wishReason;
  if (stored) return stored;
  if (r.wear.avgRating != null && r.wear.avgRating >= 4) return `Loved the sample · ★${formatAvg(r.wear.avgRating)}`;
  return 'Added by you';
}
