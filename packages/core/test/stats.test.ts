import { describe, expect, it } from 'vitest';
import { collectionStats, formatGbp, type StatItem, type WearLite } from '../src/index.js';

const item = (perfumeId: string, over: Partial<StatItem> = {}): StatItem => ({
  perfumeId, house: 'House', name: perfumeId, family: 'woody', seasons: ['autumn'], format: 'full', status: 'owned', sizeMl: 50, price: null, typicalPerMl: null, ...over,
});
const wear = (perfumeId: string, wornOn: string, rating: number | null = null): WearLite => ({ id: `${perfumeId}${wornOn}${rating}`, perfumeId, wornOn, rating });
const TODAY = '2026-11-02';

describe('collectionStats', () => {
  it('counts bottles, samples and sets, excluding gone and wishlist', () => {
    const s = collectionStats([item('a'), item('b', { format: 'travel' }), item('c', { format: 'sample' }), item('d', { status: 'gone' }), item('e', { status: 'wishlist' })], [], 2, TODAY);
    expect(s).toMatchObject({ bottles: 2, samples: 1, sets: 2 });
  });
  it('value: price when set, else typical × size, else unpriced', () => {
    const s = collectionStats([item('a', { price: 220 }), item('b', { typicalPerMl: 1.5, sizeMl: 100 }), item('c', { typicalPerMl: 2, sizeMl: null }), item('d', { status: 'gone', price: 999 })], [], 0, TODAY);
    expect(s.value).toEqual({ total: 370, unpriced: 1 });
  });
  it('breakdowns count owned perfumes once (families, seasons, houses) and owned items by format', () => {
    const s = collectionStats([item('a', { format: 'full' }), item('a', { format: 'sample' }), item('b', { family: 'citrus', seasons: ['summer', 'spring'] }), item('c', { family: null, seasons: [] })], [], 0, TODAY);
    expect(s.byFamily).toEqual([{ key: 'woody', count: 1 }, { key: 'citrus', count: 1 }, { key: 'unknown', count: 1 }]);
    expect(s.bySeason).toEqual([{ key: 'spring', count: 1 }, { key: 'summer', count: 1 }, { key: 'autumn', count: 1 }, { key: 'winter', count: 0 }]);
    expect(s.byFormat).toEqual([{ key: 'full', count: 3 }, { key: 'sample', count: 1 }]);
  });
  it('houses cap at 8 plus Other, largest first', () => {
    const items = Array.from({ length: 10 }, (_, i) => item(`p${i}`, { house: `H${i}` })).concat([item('x', { house: 'H0' })]);
    const s = collectionStats(items, [], 0, TODAY);
    expect(s.byHouse).toHaveLength(9);
    expect(s.byHouse[0]).toEqual({ key: 'H0', count: 2 });
    expect(s.byHouse[8]).toEqual({ key: 'Other', count: 2 });
  });
  it('neglected: owned perfumes not worn in 90 days, including never worn', () => {
    const s = collectionStats([item('a'), item('b'), item('c'), item('g', { status: 'gone' })], [wear('a', '2026-10-30'), wear('b', '2026-07-01'), wear('g', '2026-01-01')], 0, TODAY);
    expect(s.neglected).toBe(2);
  });
  it('most worn counts all wears; top rated needs 2 rated wears', () => {
    const s = collectionStats(
      [item('a'), item('b'), item('c')],
      [wear('a', '2026-10-01', 3), wear('a', '2026-10-02', 3), wear('a', '2026-10-03'), wear('b', '2026-10-01', 5), wear('c', '2026-10-01', 4), wear('c', '2026-10-05', 5)],
      0,
      TODAY,
    );
    expect(s.mostWorn).toEqual({ perfumeId: 'a', house: 'House', name: 'a', count: 3 });
    expect(s.topRated).toEqual({ perfumeId: 'c', house: 'House', name: 'c', avg: 4.5 });
  });
  it('empty input gives zeros and nulls', () => {
    expect(collectionStats([], [], 0, TODAY)).toEqual({
      bottles: 0, samples: 0, sets: 0, value: { total: 0, unpriced: 0 }, byFamily: [], bySeason: [{ key: 'spring', count: 0 }, { key: 'summer', count: 0 }, { key: 'autumn', count: 0 }, { key: 'winter', count: 0 }], byHouse: [], byFormat: [], neglected: 0, mostWorn: null, topRated: null,
    });
  });
});

describe('formatGbp', () => {
  it('rounds to pounds, then thousands from £1,000', () => {
    expect([0, 839.6, 999, 1000, 3249, 12500].map(formatGbp)).toEqual(['£0', '£840', '£999', '£1k', '£3.2k', '£12.5k']);
  });
});

describe('formatGbp thousands', () => {
  it('drops a trailing .0', () => {
    expect(formatGbp(1000)).toBe('£1k');
    expect(formatGbp(1050)).toBe('£1.1k');
    expect(formatGbp(3200)).toBe('£3.2k');
    expect(formatGbp(999)).toBe('£999');
  });
});
