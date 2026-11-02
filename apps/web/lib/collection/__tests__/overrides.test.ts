import { describe, expect, it } from 'vitest';
import { latestOverrides, overridePatch } from '../overrides';

const perfume = { family: 'oriental', seasons: ['autumn', 'winter'], longevity: 'long', release_year: 2015 };

describe('overridePatch', () => {
  it('sets a key when the edit differs from the perfume', () => {
    expect(overridePatch({}, perfume, { family: 'woody' })).toEqual({ family: 'woody' });
  });
  it('removes a key when the edit equals the perfume value again', () => {
    expect(overridePatch({ family: 'woody' }, perfume, { family: 'oriental' })).toEqual({});
  });
  it('keeps untouched keys', () => {
    expect(overridePatch({ longevity: 'short' }, perfume, { family: 'woody' })).toEqual({ longevity: 'short', family: 'woody' });
  });
  it('compares arrays by value, ignoring order', () => {
    expect(overridePatch({}, perfume, { seasons: ['winter', 'autumn'] })).toEqual({});
    expect(overridePatch({}, perfume, { seasons: ['summer'] })).toEqual({ seasons: ['summer'] });
  });
  it('treats blank and null alike', () => {
    expect(overridePatch({}, { family: null }, { family: '' })).toEqual({});
    expect(overridePatch({}, { family: null, notes_top: [] }, { notes_top: [] })).toEqual({});
  });
});

describe('latestOverrides', () => {
  it('a newer item with no overrides does not hide edits on older items', () => {
    const items = [
      { overrides: { family: 'woody' }, updated_at: '2026-11-01T10:00:00Z' },
      { overrides: {}, updated_at: '2026-11-02T10:00:00Z' },
    ];
    expect(latestOverrides(items)).toEqual({ family: 'woody' });
  });
  it('takes the most recently updated non-empty overrides', () => {
    const items = [
      { overrides: { family: 'woody' }, updated_at: '2026-11-01T10:00:00Z' },
      { overrides: { family: 'citrus' }, updated_at: '2026-11-02T10:00:00Z' },
    ];
    expect(latestOverrides(items)).toEqual({ family: 'citrus' });
  });
  it('no overrides anywhere gives {}', () => {
    expect(latestOverrides([{ overrides: {}, updated_at: 'x' }, { overrides: null, updated_at: 'y' }])).toEqual({});
  });
});
