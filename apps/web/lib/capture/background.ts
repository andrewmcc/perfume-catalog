// Known empty backgrounds (the table under the guide), learned from shots the server called
// "not a perfume". A later auto-capture must differ from them, so lifting a bottle away
// doesn't photograph the empty table.
import type { Rect } from './detector';

/** Grid cells per side for the coarse signature. */
const GRID = 8;
/** Mean block difference below which a view counts as the same background. */
export const BACKGROUND_MATCH = 10;

export type Signature = Float32Array;

/**
 * Block means over the rect on a GRID × GRID grid, minus their overall mean. Coarse blocks
 * shrug off hand shake; removing the mean shrugs off exposure changes.
 */
export function blockSignature(gray: Uint8Array, w: number, _h: number, r: Rect): Signature {
  const sums = new Float32Array(GRID * GRID);
  const counts = new Uint32Array(GRID * GRID);
  for (let y = r.y; y < r.y + r.h; y++) {
    const by = Math.min(GRID - 1, Math.floor(((y - r.y) * GRID) / r.h));
    for (let x = r.x; x < r.x + r.w; x++) {
      const b = by * GRID + Math.min(GRID - 1, Math.floor(((x - r.x) * GRID) / r.w));
      sums[b] += gray[y * w + x];
      counts[b]++;
    }
  }
  let mean = 0;
  for (let i = 0; i < sums.length; i++) {
    sums[i] = counts[i] ? sums[i] / counts[i] : 0;
    mean += sums[i];
  }
  mean /= sums.length;
  for (let i = 0; i < sums.length; i++) sums[i] -= mean;
  return sums;
}

export function signatureDiff(a: Signature, b: Signature): number {
  let t = 0;
  for (let i = 0; i < a.length; i++) t += Math.abs(a[i] - b[i]);
  return t / a.length;
}

/** The last `max` backgrounds; distance() is to the nearest (Infinity when none are known). */
export function createBackgrounds(max = 4) {
  let list: Signature[] = [];
  return {
    add(s: Signature) {
      list = [...list, s].slice(-max);
    },
    distance(s: Signature): number {
      return list.reduce((best, b) => Math.min(best, signatureDiff(s, b)), Infinity);
    },
    get size() {
      return list.length;
    },
  };
}
