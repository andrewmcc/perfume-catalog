import { describe, expect, it } from 'vitest';
import { notesOf, wearItemFor } from '../wear-helpers';

describe('wearItemFor', () => {
  it('prefers an owned non-sample item, then any owned item, else null', () => {
    expect(wearItemFor([{ id: 's', status: 'owned', format: 'sample' }, { id: 'f', status: 'owned', format: 'full' }])).toBe('f');
    expect(wearItemFor([{ id: 'g', status: 'gone', format: 'full' }, { id: 's', status: 'owned', format: 'sample' }])).toBe('s');
    expect(wearItemFor([{ id: 'g', status: 'gone', format: 'full' }, { id: 'w', status: 'wishlist', format: 'full' }])).toBeNull();
  });
});

describe('notesOf', () => {
  it('keeps wears with notes or a rating, newest first', () => {
    const w = (id: string, worn_on: string, rating: number | null, notes: string | null, created_at = '2026-01-01T00:00:00Z') => ({ id, worn_on, rating, notes, time_of_day: null, created_at });
    const out = notesOf([w('a', '2026-10-01', null, null), w('b', '2026-10-17', 4, null), w('c', '2026-09-12', null, 'Too much'), w('d', '2026-10-17', 5, 'Later', '2026-10-17T20:00:00Z')]);
    expect(out.map((n) => n.id)).toEqual(['d', 'b', 'c']);
    expect(out[0]).toEqual({ id: 'd', wornOn: '2026-10-17', rating: 5, notes: 'Later', timeOfDay: null });
  });
});
