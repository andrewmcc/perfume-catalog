// Frame metrics for auto-capture. All functions work on 8-bit
// grayscale frames (row-major, one byte per pixel).

export type Rect = { x: number; y: number; w: number; h: number };

export type FrameMetrics = {
  /** Laplacian variance inside the square — focus / detail. */
  sharpness: number;
  /** Mean absolute difference vs previous frame, 0–255 — motion. */
  diff: number;
  /** Edge density inside the square ÷ edge density in the surrounding ring. */
  edgeRatio: number;
  /** Mean absolute difference vs the frame at the last capture, 0–255 (255 if none) — has the view changed? */
  sinceFire: number;
  /** Fraction (0–1) of pixels inside the square that are blown out (luma ≥ threshold). */
  glare: number;
  /** Block-signature difference from the nearest known empty background (Infinity if none). */
  sinceBackground: number;
};

export function toGray(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = Math.round(0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]);
  }
  return gray;
}

export function sharpness(gray: Uint8Array, w: number, h: number, r: Rect): number {
  const x0 = Math.max(1, r.x);
  const y0 = Math.max(1, r.y);
  const x1 = Math.min(w - 1, r.x + r.w);
  const y1 = Math.min(h - 1, r.y + r.h);
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * w + x;
      const lap = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function frameDiff(a: Uint8Array, b: Uint8Array): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return a.length ? total / a.length : 0;
}

export function edgeRatio(gray: Uint8Array, w: number, h: number, inner: Rect, edgeThreshold = 40): number {
  let inEdges = 0;
  let inTotal = 0;
  let outEdges = 0;
  let outTotal = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1] - gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1];
      const gy =
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1] - gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1];
      const isEdge = Math.hypot(gx, gy) > edgeThreshold ? 1 : 0;
      const inside = x >= inner.x && x < inner.x + inner.w && y >= inner.y && y < inner.y + inner.h;
      if (inside) {
        inEdges += isEdge;
        inTotal++;
      } else {
        outEdges += isEdge;
        outTotal++;
      }
    }
  }
  const inFrac = inTotal ? inEdges / inTotal : 0;
  const outFrac = outTotal ? outEdges / outTotal : 0;
  return inFrac / (outFrac + 0.01);
}

export function glareFraction(gray: Uint8Array, w: number, h: number, r: Rect, threshold = 250): number {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(w, r.x + r.w);
  const y1 = Math.min(h, r.y + r.h);
  let hot = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (gray[y * w + x] >= threshold) hot++;
      n++;
    }
  }
  return n ? hot / n : 0;
}
