import { describe, expect, it } from 'vitest';
import { stripStatus } from '../strip-status';

describe('stripStatus', () => {
  it('removes status objects recursively, including inside arrays', () => {
    const input = {
      house: 'Dior',
      status: { house: 'read' },
      vials: [{ name: 'A', status: { name: 'read' } }],
      scents: [{ name: 'B', notes: { top: 'x', status: 1 } }],
    };
    expect(stripStatus(input)).toEqual({
      house: 'Dior',
      vials: [{ name: 'A' }],
      scents: [{ name: 'B', notes: { top: 'x' } }],
    });
  });

  it('does not mutate the input and passes primitives through', () => {
    const input = { a: 1, status: {} };
    stripStatus(input);
    expect(input).toHaveProperty('status');
    expect(stripStatus('x')).toBe('x');
    expect(stripStatus(null)).toBe(null);
  });
});
