import { describe, expect, it } from 'vitest';
import { wearPatch } from '../wear-patch';

describe('wearPatch', () => {
  it('maps the form to columns; blank notes and unset fields become null', () => {
    expect(wearPatch({ wornOn: '2026-11-02', timeOfDay: null, rating: null, notes: '   ' })).toEqual({ worn_on: '2026-11-02', time_of_day: null, rating: null, notes: null });
  });
  it('trims notes and keeps a rating and time of day', () => {
    expect(wearPatch({ wornOn: '2026-10-17', timeOfDay: 'evening', rating: 4, notes: ' Two sprays. ' })).toEqual({ worn_on: '2026-10-17', time_of_day: 'evening', rating: 4, notes: 'Two sprays.' });
  });
  it('never sends perfume_id or collection_id', () => {
    const p = wearPatch({ wornOn: '2026-11-02', timeOfDay: null, rating: 5, notes: '', perfume_id: 'x', collection_id: 'y' } as never);
    expect(p).not.toHaveProperty('perfume_id');
    expect(p).not.toHaveProperty('collection_id');
  });
  it('rejects long notes, bad dates and out-of-range ratings', () => {
    expect(() => wearPatch({ wornOn: '2026-11-02', timeOfDay: null, rating: null, notes: 'x'.repeat(2001) })).toThrow('Notes are too long');
    expect(() => wearPatch({ wornOn: '2026-02-30', timeOfDay: null, rating: null, notes: '' })).toThrow('Pick a date');
    expect(() => wearPatch({ wornOn: '2026-11-02', timeOfDay: null, rating: 6, notes: '' })).toThrow();
  });
});
