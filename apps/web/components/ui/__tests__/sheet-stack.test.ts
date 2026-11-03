import { describe, expect, it } from 'vitest';
import { createSheetStack } from '../sheet-stack';

describe('sheet stack', () => {
  it('only the most recently opened sheet is on top; closing reveals the one below', () => {
    const s = createSheetStack();
    const a = s.open();
    const b = s.open();
    expect(s.isTop(a)).toBe(false);
    expect(s.isTop(b)).toBe(true);
    s.close(b);
    expect(s.isTop(a)).toBe(true);
    expect(s.size()).toBe(1);
    s.close(a);
    expect(s.size()).toBe(0);
  });
  it('closing out of order still leaves the right top', () => {
    const s = createSheetStack();
    const a = s.open();
    const b = s.open();
    s.close(a);
    expect(s.isTop(b)).toBe(true);
  });
});

describe('scroll lock', () => {
  it('locks on the first sheet and restores the original value only after the last closes, in any order', () => {
    const body = { overflow: 'scroll' };
    const s = createSheetStack({ lock: () => { const was = body.overflow; body.overflow = 'hidden'; return () => { body.overflow = was; }; } });
    const parent = s.open();
    const child = s.open();
    expect(body.overflow).toBe('hidden');
    s.close(parent); // parent's cleanup runs first when a tree unmounts
    expect(body.overflow).toBe('hidden');
    s.close(child);
    expect(body.overflow).toBe('scroll');
  });
});
