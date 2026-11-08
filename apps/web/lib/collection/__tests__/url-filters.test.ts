import { describe, expect, it } from 'vitest';
import type { CollectionRow } from '@perfume/core';
import { BOTTLE_FORMATS, collectionCountLabel, collectionHref, parseCollectionUrl, shownItemCount } from '../url-filters';

describe('parseCollectionUrl', () => {
  it('reads several formats (bottles from Stats)', () => {
    expect(parseCollectionUrl({ format: ['full', 'travel', 'decant'] })).toEqual({ view: 'owned', filters: { format: ['full', 'travel', 'decant'] } });
  });
  it('reads one format', () => {
    expect(parseCollectionUrl({ format: 'sample' }).filters).toEqual({ format: ['sample'] });
  });
  it('opens the sets view', () => {
    expect(parseCollectionUrl({ view: 'sets' }).view).toBe('sets');
  });
  it('ignores unknown formats and views', () => {
    expect(parseCollectionUrl({ format: ['bogus', 'sample'], view: 'nope' })).toEqual({ view: 'owned', filters: { format: ['sample'] } });
  });
  it('reads a family and a season (from Stats)', () => {
    expect(parseCollectionUrl({ family: 'floral' }).filters).toEqual({ family: ['floral'] });
    expect(parseCollectionUrl({ season: 'winter' }).filters).toEqual({ season: ['winter'] });
  });
  it('ignores families and seasons it does not know', () => {
    expect(parseCollectionUrl({ family: 'unknown', season: 'monsoon' }).filters).toEqual({});
  });
  it('still reads worn and rating', () => {
    expect(parseCollectionUrl({ worn: 'neglected', rating: '4' }).filters).toEqual({ worn: ['neglected'], rating: ['4'] });
  });
});

describe('collectionHref', () => {
  it('builds the bottles link', () => {
    expect(collectionHref({ format: [...BOTTLE_FORMATS] })).toBe('/collection?format=full&format=travel&format=decant');
  });
  it('builds the sets link', () => {
    expect(collectionHref({}, 'sets')).toBe('/collection?view=sets');
  });
});

const row = (formats: string[]) => ({ items: formats.map((format) => ({ format })) }) as unknown as CollectionRow;

describe('shownItemCount', () => {
  it('counts every item with no format filter', () => {
    expect(shownItemCount([row(['full', 'sample']), row(['sample'])], {})).toBe(3);
  });
  it('counts only items of the filtered formats, matching the Stats tile', () => {
    expect(shownItemCount([row(['full', 'sample']), row(['decant'])], { format: [...BOTTLE_FORMATS] })).toBe(2);
  });
});

describe('collectionCountLabel', () => {
  it('shows items alone when every perfume has one item', () => {
    expect(collectionCountLabel(7, 7)).toBe('7 items');
  });
  it('shows perfumes too when some have several items, so Stats family and season counts are visible', () => {
    expect(collectionCountLabel(30, 33)).toBe('30 perfumes · 33 items');
  });
  it('uses the singular', () => {
    expect(collectionCountLabel(1, 1)).toBe('1 item');
    expect(collectionCountLabel(1, 2)).toBe('1 perfume · 2 items');
  });
});
