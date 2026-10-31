// Decides when to auto-capture: fire once the packet has been sharp, still and
// framed for `stableMs`, then wait until the view has settled on something that
// differs from the captured frame (flip / next packet) before arming again, so the
// same side isn't captured twice and a slow flip still re-arms.
import type { FrameMetrics } from './detector';

export type { FrameMetrics };

export type GateConfig = {
  minSharpness: number;
  maxDiff: number;
  minEdgeRatio: number;
  stableMs: number;
  rearmDiff: number;
  /** Max fraction of blown-out pixels in the square; 1 disables the check. */
  maxGlare: number;
};

// Tuned from iPhone sessions (real packets, hand-held, 4K stream): frame diff ~6–25.
// Edge ratio is off by default (0): with a packet in hand the ring around the square
// (fingers, packet edges, table) is busier than the inside — measured 0.77–1.4.
export const DEFAULT_GATE: GateConfig = {
  minSharpness: 2500,
  maxDiff: 15,
  minEdgeRatio: 0,
  stableMs: 500,
  rearmDiff: 25,
  maxGlare: 1,
};

export type GateState = 'armed' | 'steadying' | 'waiting-for-change';

export function createCaptureGate(cfg: GateConfig) {
  let state: GateState = 'armed';
  let steadySince = 0;

  const isGood = (m: FrameMetrics) =>
    m.sharpness >= cfg.minSharpness && m.diff <= cfg.maxDiff && m.edgeRatio >= cfg.minEdgeRatio && m.glare <= cfg.maxGlare;

  return {
    push(m: FrameMetrics, nowMs: number): { state: GateState; fire: boolean } {
      if (state === 'waiting-for-change') {
        if (m.diff > cfg.maxDiff || m.sinceFire < cfg.rearmDiff) return { state, fire: false };
        state = 'armed';
      }
      if (!isGood(m)) {
        state = 'armed';
        return { state, fire: false };
      }
      if (state === 'armed') {
        state = 'steadying';
        steadySince = nowMs;
      }
      if (nowMs - steadySince >= cfg.stableMs) {
        state = 'waiting-for-change';
        return { state, fire: true };
      }
      return { state, fire: false };
    },
    reset() {
      state = 'armed';
    },
    /** After a manual capture: don't auto-fire on the same side. */
    lockUntilChange() {
      state = 'waiting-for-change';
    },
  };
}
