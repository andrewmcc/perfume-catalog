import { describe, expect, it } from 'vitest';
import { couldntRead } from '../couldnt-read';

describe('couldntRead', () => {
  it('a set whose box was read but showed no scents: says so, and offers no pointless re-read', () => {
    const r = couldntRead({ mode: 'set', status: 'extracted', error: null, set: { house: "Penhaligon's", name: 'Potions & Remedies' } });
    expect(r.text).toBe('Read the box (Penhaligon’s Potions & Remedies), but no scent names were in the photo. Add them, or scan again with the box open.');
    expect(r.readAgain).toBe(false);
  });
  it('a set with only a house read', () => {
    expect(couldntRead({ mode: 'set', status: 'extracted', error: null, set: { house: 'Amouage', name: null } }).text).toMatch(/^Read the box \(Amouage\)/);
  });
  it('a failed read keeps its error and can be read again', () => {
    expect(couldntRead({ mode: 'bottle', status: 'failed', error: 'Timed out', set: null })).toEqual({ text: 'Timed out', readAgain: true });
  });
  it('an extracted photo with nothing in it: same photo, same answer, so no re-read', () => {
    expect(couldntRead({ mode: 'samples', status: 'extracted', error: null, set: null })).toEqual({ text: 'Nothing could be read from this photo.', readAgain: false });
  });
});
