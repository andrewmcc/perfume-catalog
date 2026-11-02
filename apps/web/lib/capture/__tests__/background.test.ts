import { describe, expect, it } from 'vitest';
import { BACKGROUND_MATCH, blockSignature, createBackgrounds, signatureDiff } from '../background';
import type { Rect } from '../detector';

const W = 160;
const INNER: Rect = { x: 16, y: 16, w: 128, h: 128 };

/** A wood-grain-ish table: smooth stripes plus deterministic noise; shift moves it, gain brightens it. */
function table(shift = 0, gain = 0): Uint8Array {
  const g = new Uint8Array(W * W);
  let seed = 7;
  for (let y = 0; y < W; y++)
    for (let x = 0; x < W; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const noise = (seed % 40) - 20;
      g[y * W + x] = Math.max(0, Math.min(255, 110 + 30 * Math.sin((x + shift) / 9) + noise + gain));
    }
  return g;
}
/** The table with a dark bottle with a pale label standing in the middle. */
function withBottle(t: Uint8Array): Uint8Array {
  const g = t.slice();
  for (let y = 40; y < 140; y++) for (let x = 58; x < 102; x++) g[y * W + x] = y > 75 && y < 110 ? 225 : 35;
  return g;
}

const sig = (g: Uint8Array) => blockSignature(g, W, W, INNER);

describe('background signatures', () => {
  it('the same table under hand shake or an exposure change still matches', () => {
    expect(signatureDiff(sig(table()), sig(table(2)))).toBeLessThan(BACKGROUND_MATCH);
    expect(signatureDiff(sig(table()), sig(table(0, 30)))).toBeLessThan(BACKGROUND_MATCH);
  });
  it('a bottle on the table does not match the empty table', () => {
    expect(signatureDiff(sig(table()), sig(withBottle(table(1))))).toBeGreaterThan(BACKGROUND_MATCH * 2);
  });
  it('the store returns the nearest background, Infinity when empty, and keeps only the latest few', () => {
    const b = createBackgrounds(2);
    expect(b.distance(sig(table()))).toBe(Infinity);
    b.add(sig(withBottle(table())));
    b.add(sig(table()));
    expect(b.distance(sig(table(2)))).toBeLessThan(BACKGROUND_MATCH);
    b.add(sig(withBottle(table(40))));
    b.add(sig(withBottle(table(80))));
    expect(b.distance(sig(table(2)))).toBeGreaterThan(BACKGROUND_MATCH); // the table frame was evicted
  });
});
