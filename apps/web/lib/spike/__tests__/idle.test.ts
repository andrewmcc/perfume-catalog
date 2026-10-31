import { describe, expect, it } from 'vitest';
import { createIdleTimer } from '../idle';

describe('createIdleTimer', () => {
  it('becomes idle exactly at the timeout after the last touch', () => {
    const idle = createIdleTimer(20_000);
    idle.touch(0);
    expect(idle.isIdle(19_999)).toBe(false);
    expect(idle.isIdle(20_000)).toBe(true);
  });

  it('touch resets the clock', () => {
    const idle = createIdleTimer(20_000);
    idle.touch(0);
    idle.touch(15_000);
    expect(idle.isIdle(30_000)).toBe(false);
    expect(idle.isIdle(35_000)).toBe(true);
  });
});
