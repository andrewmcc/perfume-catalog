import { describe, expect, it } from 'vitest';
import { addMonths, monthGrid, monthLabel, wearSummary } from '../src/index.js';

describe('monthGrid', () => {
  it('November 2026 starts on Monday 26 October and has 6 weeks', () => {
    const g = monthGrid('2026-11');
    expect(g).toHaveLength(6);
    expect(g[0]![0]).toEqual({ date: '2026-10-26', inMonth: false });
    expect(g[0]![6]).toEqual({ date: '2026-11-01', inMonth: true });
    expect(g.flat().filter((d) => d.inMonth)).toHaveLength(30);
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it('February 2028 has 29 in-month days; October 2026 spans the clock change', () => {
    expect(monthGrid('2028-02').flat().filter((d) => d.inMonth)).toHaveLength(29);
    const oct = monthGrid('2026-10').flat().map((d) => d.date);
    expect(oct).toContain('2026-10-25');
    expect(new Set(oct).size).toBe(oct.length);
  });
  it('month helpers', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthLabel('2026-10')).toBe('October 2026');
  });
});

describe('wearSummary', () => {
  it('counts, averages rated wears to one decimal, and takes the latest date', () => {
    const s = wearSummary([
      { id: '1', perfumeId: 'p', wornOn: '2026-10-01', rating: 4 },
      { id: '2', perfumeId: 'p', wornOn: '2026-10-17', rating: 5 },
      { id: '3', perfumeId: 'p', wornOn: '2026-10-09', rating: 4 },
      { id: '4', perfumeId: 'p', wornOn: '2026-09-01', rating: null },
      { id: '5', perfumeId: 'q', wornOn: '2026-09-01', rating: null },
    ]);
    expect(s.get('p')).toEqual({ count: 4, avgRating: 4.3, ratedCount: 3, lastWorn: '2026-10-17' });
    expect(s.get('q')).toEqual({ count: 1, avgRating: null, ratedCount: 0, lastWorn: '2026-09-01' });
    expect(s.get('none')).toBeUndefined();
  });
});
