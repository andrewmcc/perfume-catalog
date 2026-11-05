import { describe, expect, it } from 'vitest';
import { readingOutcome } from '../reading';

// `before` is the scan's updated_at when Read again was tapped (server clock, like the polled row).
const before = '2026-11-05T22:00:00.000Z';
const at = (s: number) => new Date(Date.parse(before) + s * 1000).toISOString();

describe('readingOutcome', () => {
  it('is still reading while queued or processing', () => {
    expect(readingOutcome({ status: 'processing', updated_at: at(1) }, before, 5_000)).toBe('reading');
    expect(readingOutcome({ status: 'uploaded', updated_at: at(1) }, before, 5_000)).toBe('reading');
  });
  it('the unchanged row is the old read still showing, not the new one', () => {
    expect(readingOutcome({ status: 'failed', updated_at: before }, before, 2_000)).toBe('reading');
    expect(readingOutcome({ status: 'extracted', updated_at: before }, before, 2_000)).toBe('reading');
  });
  it('settles once the scan has changed', () => {
    expect(readingOutcome({ status: 'extracted', updated_at: at(20) }, before, 21_000)).toBe('done');
    expect(readingOutcome({ status: 'reviewed', updated_at: at(20) }, before, 21_000)).toBe('done');
    expect(readingOutcome({ status: 'failed', updated_at: at(20) }, before, 21_000)).toBe('failed');
  });
  it('a scan that is gone is settled', () => {
    expect(readingOutcome(null, before, 2_000)).toBe('done');
  });
  it('stops waiting after five minutes', () => {
    expect(readingOutcome({ status: 'processing', updated_at: at(1) }, before, 5 * 60_000 + 1)).toBe('slow');
  });
});
