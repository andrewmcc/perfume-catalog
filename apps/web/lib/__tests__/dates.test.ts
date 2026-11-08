import { describe, expect, it } from 'vitest';
import { shortDayYear } from '../dates';

describe('shortDayYear', () => {
  it('shows weekday, day, month and year', () => {
    expect(shortDayYear('2026-10-17')).toBe('Sat 17 Oct 2026');
  });
});
