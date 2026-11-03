import { describe, expect, it } from 'vitest';
import type { CollectionRow } from '@perfume/core';
import { pairsFor } from '../select';

let n = 0;
const row = (status: string, base: string[], over: Partial<CollectionRow> = {}): CollectionRow => {
  n += 1;
  return {
    perfumeId: `p${n}`,
    house: 'H',
    name: `N${n}`,
    concentration: null,
    family: 'oriental',
    sillage: null,
    seasons: [],
    times: [],
    occasions: [],
    accords: ['sweet'],
    notes: { top: [], heart: [], base },
    weight: 'base',
    thumb: null,
    items: [{ id: `i${n}`, format: 'full', size_ml: 50, status, setId: null, setName: null }],
    wear: { count: 0, avgRating: null, lastWorn: null },
    ...over,
  };
};

describe('pairsFor', () => {
  it('only owned perfumes other than the target are candidates', () => {
    const target = row('wishlist', ['vanilla', 'tonka']);
    const owned = row('owned', ['vanilla', 'tonka']);
    const wished = row('wishlist', ['vanilla', 'tonka']);
    const gone = row('gone', ['vanilla', 'tonka']);
    const got = pairsFor([target, owned, wished, gone], target.perfumeId)!;
    expect(got.likes.map((p) => p.perfume.perfumeId)).toEqual([owned.perfumeId]);
    expect(got.layers).toEqual([]);
  });
  it('null for an unknown perfume', () => {
    expect(pairsFor([row('owned', ['vanilla'])], 'nope')).toBeNull();
  });
});
