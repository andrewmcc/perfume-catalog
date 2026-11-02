import { describe, expect, it } from 'vitest';
import { CLAUDE_MAX_RETRIES, CLAUDE_TIMEOUT_MS, ROUTE_MAX_DURATION_S, SWEEP_START_BUDGET_MS, runLimited } from '../budget';

describe('extraction time budget', () => {
  it('two attempts with SDK retries finish inside the route limit', () => {
    const worstAttemptMs = CLAUDE_TIMEOUT_MS * (CLAUDE_MAX_RETRIES + 1);
    expect(2 * worstAttemptMs).toBeLessThan(ROUTE_MAX_DURATION_S * 1000 - 30_000);
  });

  it('a sweep scan started at the last moment still finishes inside the route limit', () => {
    const worstScanMs = 2 * CLAUDE_TIMEOUT_MS * (CLAUDE_MAX_RETRIES + 1);
    expect(SWEEP_START_BUDGET_MS + worstScanMs).toBeLessThan(ROUTE_MAX_DURATION_S * 1000 - 10_000);
  });
});

describe('runLimited', () => {
  it('runs every item with at most `limit` in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const done: number[] = [];
    await runLimited([1, 2, 3, 4, 5], 2, Infinity, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      done.push(n);
      inFlight--;
    });
    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });

  it('stops starting new items once the start budget is spent', async () => {
    const started: number[] = [];
    await runLimited([1, 2, 3, 4], 1, 15, async (n) => {
      started.push(n);
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(started).toEqual([1]);
  });

  it('a failing task does not stop the others', async () => {
    const done: number[] = [];
    await runLimited([1, 2, 3], 1, Infinity, async (n) => {
      if (n === 2) throw new Error('boom');
      done.push(n);
    });
    expect(done).toEqual([1, 3]);
  });
});
