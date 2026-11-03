import { describe, expect, it } from 'vitest';
import { groupSources } from '../sources';

describe('groupSources', () => {
  it('the most common source labels the section; only rows that differ keep their own badge', () => {
    expect(groupSources(['ai', 'ai', 'edited', 'ai', null])).toEqual({ section: 'ai', row: [null, null, 'edited', null, null] });
  });
  it('a tie goes to the first source seen', () => {
    expect(groupSources(['label', 'ai'])).toEqual({ section: 'label', row: [null, 'ai'] });
  });
  it('nothing known: no section badge', () => {
    expect(groupSources([null, null])).toEqual({ section: null, row: [null, null] });
  });
});
