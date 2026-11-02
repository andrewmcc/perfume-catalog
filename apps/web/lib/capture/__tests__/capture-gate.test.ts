import { describe, expect, it } from 'vitest';
import { DEFAULT_GATE, createCaptureGate, type FrameMetrics } from '../capture-gate';

// sinceFire = difference from the frame captured at the last fire.
const GOOD: FrameMetrics = { sharpness: 1e6, diff: 0, edgeRatio: 100, sinceFire: 0, glare: 0, sinceBackground: Infinity };
const BAD: FrameMetrics = { sharpness: 0, diff: 0, edgeRatio: 1, sinceFire: 0, glare: 0, sinceBackground: Infinity };
const NEW_SIDE: FrameMetrics = { ...GOOD, sinceFire: DEFAULT_GATE.rearmDiff + 20 };
const JOLT: FrameMetrics = { ...GOOD, diff: DEFAULT_GATE.rearmDiff + 20, sinceFire: DEFAULT_GATE.rearmDiff + 20 };

type Frame = [number, FrameMetrics];

function fireTimes(frames: Frame[]): number[] {
  const gate = createCaptureGate(DEFAULT_GATE);
  return frames.filter(([t, m]) => gate.push(m, t).fire).map(([t]) => t);
}

const every100 = (from: number, to: number, m: FrameMetrics): Frame[] => {
  const out: Frame[] = [];
  for (let t = from; t <= to; t += 100) out.push([t, m]);
  return out;
};

describe('capture gate', () => {
  it('never fires on a view that matches a known empty background', () => {
    const EMPTY_TABLE: FrameMetrics = { ...GOOD, sinceFire: 255, sinceBackground: DEFAULT_GATE.minBackgroundDiff / 2 };
    expect(fireTimes(every100(0, 3000, EMPTY_TABLE))).toEqual([]);
  });

  it('a bottle placed on that table still fires', () => {
    const BOTTLE: FrameMetrics = { ...GOOD, sinceFire: 255, sinceBackground: DEFAULT_GATE.minBackgroundDiff * 3 };
    expect(fireTimes(every100(0, 1000, BOTTLE))).toEqual([500]);
  });

  it('fires once after 500ms of steady good frames', () => {
    expect(fireTimes(every100(0, 1000, GOOD))).toEqual([500]);
  });

  it('a bad frame restarts the steady clock', () => {
    const frames = [...every100(0, 200, GOOD), [300, BAD] as Frame, ...every100(400, 1200, GOOD)];
    expect(fireTimes(frames)).toEqual([900]);
  });

  it('does not re-capture the same side while held still', () => {
    expect(fireTimes(every100(0, 2500, GOOD))).toEqual([500]);
  });

  it('a jolt that settles back on the same side does not cause a second capture', () => {
    const frames = [...every100(0, 1000, GOOD), [1100, JOLT] as Frame, ...every100(1200, 3000, GOOD)];
    expect(fireTimes(frames)).toEqual([500]);
  });

  it('a slow flip (no single big frame-to-frame jump) still re-arms once the new side is steady', () => {
    // Every frame is steady (diff 0) — only the difference from the fired frame grows.
    // After the 1600 capture the reference frame is the new side, so sinceFire drops back to 0.
    const frames = [...every100(0, 1000, GOOD), ...every100(1100, 1600, NEW_SIDE), ...every100(1700, 2500, GOOD)];
    expect(fireTimes(frames)).toEqual([500, 1600]);
  });

  it('reset() re-arms immediately', () => {
    const gate = createCaptureGate(DEFAULT_GATE);
    for (let t = 0; t <= 500; t += 100) gate.push(GOOD, t);
    gate.reset();
    const fired = [600, 700, 800, 900, 1000, 1100].filter((t) => gate.push(GOOD, t).fire);
    expect(fired).toEqual([1100]);
  });

  it('lockUntilChange() (manual shutter) blocks auto-fire until a new steady view', () => {
    const gate = createCaptureGate(DEFAULT_GATE);
    gate.lockUntilChange();
    const fired = [0, 100, 200, 300, 400, 500, 600].filter((t) => gate.push(GOOD, t).fire);
    expect(fired).toEqual([]);
    const after = [700, 800, 900, 1000, 1100, 1200].filter((t) => gate.push(NEW_SIDE, t).fire);
    expect(after).toEqual([1200]);
  });
});

describe('glare rule', () => {
  const cfg = { ...DEFAULT_GATE, maxGlare: 0.05 };
  const run = (m: FrameMetrics, c = cfg) => {
    const gate = createCaptureGate(c);
    return every100(0, 2000, m).filter(([t, f]) => gate.push(f, t).fire).map(([t]) => t);
  };

  it('does not fire while glare exceeds maxGlare', () => {
    expect(run({ ...GOOD, glare: 0.2 })).toEqual([]);
  });

  it('fires at 500ms when glare is within maxGlare', () => {
    expect(run({ ...GOOD, glare: 0.01 })).toEqual([500]);
  });

  it('ignores glare with DEFAULT_GATE', () => {
    expect(run({ ...GOOD, glare: 0.9 }, DEFAULT_GATE)).toEqual([500]);
  });
});
