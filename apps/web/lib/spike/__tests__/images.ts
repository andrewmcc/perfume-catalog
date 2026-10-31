// Synthetic 160×160 grayscale frames for detector tests.
import type { Rect } from '../detector';

export const W = 160;
export const H = 160;
export const INNER: Rect = { x: 16, y: 16, w: 128, h: 128 };

export function flat(v: number): Uint8Array {
  return new Uint8Array(W * H).fill(v);
}

export function checker(size: number): Uint8Array {
  const img = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      img[y * W + x] = (Math.floor(x / size) + Math.floor(y / size)) % 2 ? 255 : 0;
  return img;
}

export function noise(seed: number, amp: number): Uint8Array {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const img = new Uint8Array(W * H);
  for (let i = 0; i < img.length; i++) img[i] = Math.round(128 + (rand() * 2 - 1) * amp);
  return img;
}

/** High-contrast "packet print" inside `inner`, `background` elsewhere. */
export function packetOn(background: Uint8Array, inner: Rect = INNER): Uint8Array {
  const img = background.slice();
  const print = checker(4);
  for (let y = inner.y; y < inner.y + inner.h; y++)
    for (let x = inner.x; x < inner.x + inner.w; x++) img[y * W + x] = print[y * W + x];
  return img;
}
