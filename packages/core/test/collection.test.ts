import { describe, expect, it } from 'vitest';
import { applyFilters, effectivePerfume, filterOptions, fold, matchesSearch, pyramidWeight, type CollectionRow, type PerfumeFacts } from '../src/index.js';

const facts = (over: Partial<PerfumeFacts> = {}): PerfumeFacts => ({
  house: 'Xerjoff',
  name: 'Naxos',
  concentration: 'edp',
  flanker: null,
  family: 'oriental',
  subfamily: null,
  accords: ['honey'],
  notes_top: ['lavender'],
  notes_heart: ['honey'],
  notes_base: ['tobacco'],
  longevity: 'long',
  sillage: 'strong',
  seasons: ['autumn'],
  times_of_day: ['evening'],
  occasions: [],
  perfumers: [],
  release_year: 2015,
  sources: { house: 'label', name: 'label', concentration: 'label', family: 'ai', notes_top: 'ai' },
  ...over,
});

const row = (over: Partial<CollectionRow> = {}): CollectionRow => ({
  perfumeId: 'p1',
  house: 'Xerjoff',
  name: 'Naxos',
  concentration: 'edp',
  family: 'oriental',
  sillage: 'strong',
  seasons: ['autumn', 'winter'],
  times: ['evening'],
  occasions: ['date'],
  accords: ['honey', 'tobacco'],
  notes: { top: ['lavender'], heart: ['honey'], base: ['tobacco'] },
  weight: 'base',
  thumb: null,
  items: [{ id: 'i1', format: 'full', size_ml: 100, status: 'owned', setId: null, setName: null }],
  wear: { count: 0, avgRating: null, lastWorn: null },
  ...over,
});

describe('effectivePerfume', () => {
  it('an override wins and reads as edited', () => {
    const e = effectivePerfume(facts(), { family: 'woody' });
    expect(e.values.family).toBe('woody');
    expect(e.source.family).toBe('edited');
  });
  it('maps perfume sources to label and ai', () => {
    const e = effectivePerfume(facts(), {});
    expect(e.source.concentration).toBe('label');
    expect(e.source.family).toBe('ai');
    expect(e.source.notes_top).toBe('ai');
  });
  it('an empty perfume gives nulls without throwing', () => {
    const e = effectivePerfume(
      facts({ family: null, accords: [], notes_top: [], notes_heart: [], notes_base: [], longevity: null, sillage: null, seasons: [], times_of_day: [], release_year: null, sources: {} }),
      {},
    );
    expect(e.values.family).toBeNull();
    expect(e.source.family).toBeNull();
    expect(e.source.notes_top).toBeNull();
  });
});

describe('pyramidWeight', () => {
  const n = (t: number, h: number, b: number) => ({ notes_top: Array(t).fill('x'), notes_heart: Array(h).fill('x'), notes_base: Array(b).fill('x') });
  it('picks the tier with most notes', () => expect(pyramidWeight(n(2, 1, 1))).toBe('top'));
  it('ties go to the heavier tier', () => {
    expect(pyramidWeight(n(1, 1, 1))).toBe('base');
    expect(pyramidWeight(n(0, 2, 2))).toBe('base');
    expect(pyramidWeight(n(2, 2, 0))).toBe('heart');
  });
  it('no notes gives null', () => expect(pyramidWeight(n(0, 0, 0))).toBeNull());
});

describe('search', () => {
  it('folds case and accents', () => expect(fold('Ébène')).toBe('ebene'));
  it('finds accented names without accents', () => expect(matchesSearch(row({ name: 'Eau de Peau Ébène' }), 'ebene')).toBe(true));
  it('finds notes and accords', () => {
    expect(matchesSearch(row(), 'tobac')).toBe(true);
    expect(matchesSearch(row(), 'lavender')).toBe(true);
  });
  it('finds house case-insensitively', () => expect(matchesSearch(row(), 'XERJ')).toBe(true));
  it('ignores apostrophe style, punctuation and spacing (iPhone types curly quotes)', () => {
    const r = row({ house: "D'Orsay", name: 'Sweet Disruption' });
    for (const q of ['d’orsay', "d'orsay", 'dorsay', 'D ORSAY', 'd’orsay sweet', 'sweet disruption']) expect(matchesSearch(r, q)).toBe(true);
    expect(matchesSearch(r, 'd’orsay bitter')).toBe(false);
  });
  it('& and "and" match', () => expect(matchesSearch(row({ house: 'Jo Malone', name: 'Earl Grey & Cucumber' }), 'earl grey and cucumber')).toBe(true));
  it('blank query matches; no match is false', () => {
    expect(matchesSearch(row(), '  ')).toBe(true);
    expect(matchesSearch(row(), 'vetiver')).toBe(false);
  });
});

const TODAY = '2026-11-02';

describe('applyFilters', () => {
  const rows = [
    row({ perfumeId: 'a', family: 'oriental', seasons: ['winter'] }),
    row({ perfumeId: 'b', family: 'citrus', seasons: ['summer'] }),
    row({ perfumeId: 'c', family: 'woody', seasons: ['winter'], items: [{ id: 'i', format: 'sample', size_ml: 2, status: 'owned', setId: 's1', setName: 'Discovery' }] }),
  ];
  const ids = (r: CollectionRow[]) => r.map((x) => x.perfumeId);
  it('empty filters keep everything', () => expect(ids(applyFilters(rows, {}, TODAY))).toEqual(['a', 'b', 'c']));
  it('OR within a key', () => expect(ids(applyFilters(rows, { family: ['oriental', 'citrus'] }, TODAY))).toEqual(['a', 'b']));
  it('AND across keys', () => expect(ids(applyFilters(rows, { family: ['oriental', 'woody'], season: ['winter'] }, TODAY))).toEqual(['a', 'c']));
  it('format and set match any item', () => {
    expect(ids(applyFilters(rows, { format: ['sample'] }, TODAY))).toEqual(['c']);
    expect(ids(applyFilters(rows, { set: ['s1'] }, TODAY))).toEqual(['c']);
  });
  it('rating keeps rows whose average is at least N; unrated rows never match', () => {
    const rated = [
      row({ perfumeId: 'r5', wear: { count: 2, avgRating: 4.5, lastWorn: '2026-10-01' } }),
      row({ perfumeId: 'r3', wear: { count: 1, avgRating: 3, lastWorn: '2026-10-01' } }),
      row({ perfumeId: 'r0', wear: { count: 1, avgRating: null, lastWorn: '2026-10-01' } }),
    ];
    expect(ids(applyFilters(rated, { rating: ['4'] }, TODAY))).toEqual(['r5']);
    expect(ids(applyFilters(rated, { rating: ['3'] }, TODAY))).toEqual(['r5', 'r3']);
  });
  it('worn: recent is within 90 days; neglected is never worn or older', () => {
    const worn = [
      row({ perfumeId: 'never' }),
      row({ perfumeId: 'old', wear: { count: 1, avgRating: null, lastWorn: '2026-08-03' } }), // 91 days
      row({ perfumeId: 'edge', wear: { count: 1, avgRating: null, lastWorn: '2026-08-04' } }), // 90 days
      row({ perfumeId: 'new', wear: { count: 1, avgRating: null, lastWorn: '2026-11-01' } }),
    ];
    expect(ids(applyFilters(worn, { worn: ['neglected'] }, TODAY))).toEqual(['never', 'old']);
    expect(ids(applyFilters(worn, { worn: ['recent'] }, TODAY))).toEqual(['edge', 'new']);
  });
  it('options list the values present', () => {
    const o = filterOptions(rows);
    expect(o.family).toEqual(['citrus', 'oriental', 'woody']);
    expect(o.format).toEqual(['full', 'sample']);
    expect(o.set).toEqual([{ id: 's1', name: 'Discovery' }]);
    expect(o.rating).toEqual([]);
    expect(o.worn).toEqual(['recent', 'neglected']);
  });
});
