import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, londonNow } from '../src/index.js';

describe('londonNow', () => {
  it('BST late evening UTC is the next London day, at night', () => {
    expect(londonNow(new Date('2026-07-01T23:30:00Z'))).toMatchObject({ date: '2026-07-02', hour: 0, minute: 30, daypart: 'night', season: 'summer' });
  });
  it('winter in GMT: London equals UTC', () => {
    expect(londonNow(new Date('2026-12-01T12:00:00Z'))).toMatchObject({ date: '2026-12-01', hour: 12, daypart: 'day', season: 'winter', phase: 'early', weekday: 'Tuesday' });
  });
  it('late autumn in November', () => {
    expect(londonNow(new Date('2026-11-20T10:00:00Z'))).toMatchObject({ season: 'autumn', phase: 'late' });
  });
  it('17:05 BST is evening; 22:00 is night; 05:00 is day', () => {
    expect(londonNow(new Date('2026-06-15T16:05:00Z')).daypart).toBe('evening');
    expect(londonNow(new Date('2026-06-15T21:00:00Z')).daypart).toBe('night');
    expect(londonNow(new Date('2026-06-15T04:00:00Z')).daypart).toBe('day');
    expect(londonNow(new Date('2026-06-15T03:59:00Z')).daypart).toBe('night');
  });
  it('mid winter in January, late in February', () => {
    expect(londonNow(new Date('2027-01-10T12:00:00Z')).phase).toBe('mid');
    expect(londonNow(new Date('2027-02-10T12:00:00Z'))).toMatchObject({ season: 'winter', phase: 'late' });
  });
});

describe('calendar dates', () => {
  it('addDays crosses the October clock change and month ends', () => {
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('daysBetween counts calendar days', () => {
    expect(daysBetween('2026-01-01', '2026-03-01')).toBe(59);
    expect(daysBetween('2026-11-02', '2026-11-02')).toBe(0);
    expect(daysBetween('2026-11-02', '2026-10-31')).toBe(-2);
  });
});
