import { describe, expect, it } from 'vitest';
import { countToReview } from '../count';

describe('countToReview', () => {
  it('counts what the Review page shows: pending results, plus each scan that could not be read', () => {
    expect(
      countToReview([
        { status: 'extracted', scan_results: [{ status: 'pending' }, { status: 'pending' }, { status: 'approved' }] },
        { status: 'extracted', scan_results: [] }, // a set box read with no scents: in "Couldn't read"
        { status: 'extracted', scan_results: [{ status: 'discarded' }] }, // nothing left pending, but never dismissed
        { status: 'failed', scan_results: [] },
      ]),
    ).toBe(5);
  });
});
