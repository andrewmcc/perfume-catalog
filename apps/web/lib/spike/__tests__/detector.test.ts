import { describe, expect, it } from 'vitest';
import { edgeRatio, frameDiff, glareFraction, sharpness, toGray } from '../detector';
import { DEFAULT_GATE } from '../capture-gate';
import { H, INNER, W, checker, flat, noise, packetOn } from './images';

const FULL = { x: 0, y: 0, w: W, h: H };

describe('toGray', () => {
  it('weights channels by Rec.601 luma', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]);
    expect(Array.from(toGray(rgba, 3, 1))).toEqual([76, 150, 29]);
  });
});

describe('sharpness', () => {
  it('is ~0 for a flat frame', () => {
    expect(sharpness(flat(128), W, H, FULL)).toBeLessThan(1);
  });

  it('separates printed detail from sensor noise by 10x', () => {
    expect(sharpness(checker(4), W, H, FULL)).toBeGreaterThan(sharpness(noise(1, 8), W, H, FULL) * 10);
  });

  it('dim noisy frame falls below the default gate threshold', () => {
    // noise(1, 8) measures ~425 in INNER (above the 200 default), so use amp 4.
    expect(sharpness(noise(1, 4), W, H, INNER)).toBeLessThan(DEFAULT_GATE.minSharpness);
    expect(sharpness(packetOn(flat(128)), W, H, INNER)).toBeGreaterThanOrEqual(DEFAULT_GATE.minSharpness);
  });
});

describe('frameDiff', () => {
  it('is 0 for identical frames and 255 for black vs white', () => {
    const img = noise(2, 30);
    expect(frameDiff(img, img)).toBe(0);
    expect(frameDiff(flat(0), flat(255))).toBe(255);
  });
});

describe('edgeRatio', () => {
  it('is high when detail is only inside the square', () => {
    expect(edgeRatio(packetOn(flat(128)), W, H, INNER)).toBeGreaterThan(3);
  });

  it('is ~1 when texture fills the whole frame (empty square over patterned surface)', () => {
    const r = edgeRatio(checker(4), W, H, INNER);
    expect(r).toBeGreaterThan(0.8);
    expect(r).toBeLessThan(1.25);
  });
});

describe('glareFraction', () => {
  it('is 0 for a mid-gray frame', () => {
    expect(glareFraction(flat(128), W, H, INNER)).toBe(0);
  });

  it('is 1 for a saturated frame', () => {
    expect(glareFraction(flat(255), W, H, INNER)).toBe(1);
  });

  it('is ~0.5 when half the square is saturated', () => {
    const img = flat(100);
    for (let y = INNER.y; y < INNER.y + INNER.h; y++)
      for (let x = INNER.x; x < INNER.x + INNER.w / 2; x++) img[y * W + x] = 255;
    expect(Math.abs(glareFraction(img, W, H, INNER) - 0.5)).toBeLessThan(0.01);
  });
});
