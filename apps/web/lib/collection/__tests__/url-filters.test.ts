import { describe, expect, it } from 'vitest';
import type { CollectionRow } from '@perfume/core';
import { BOTTLE_FORMATS, collectionHref, parseCollectionUrl, shownItemCount } from '../url-filters';

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
