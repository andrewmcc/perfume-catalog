import { describe, expect, it } from 'vitest';
import { editProposal, type Proposal } from '../proposal';

const p: Proposal = { house: 'Dior', name: 'Sauvage', concentration: 'parfum', flanker: 'Elixir', perfumeId: 'x', onShelf: 'owned' };

describe('editProposal', () => {
  it('changing house or name drops the proposed edition and the match', () => {
    expect(editProposal(p, 'name', 'Fahrenheit')).toEqual({ house: 'Dior', name: 'Fahrenheit', concentration: 'parfum', flanker: null, perfumeId: null, onShelf: null });
    expect(editProposal(p, 'house', 'Chanel').flanker).toBeNull();
  });
  it('changing the concentration keeps the edition', () => {
    expect(editProposal(p, 'concentration', '')).toMatchObject({ concentration: null, flanker: 'Elixir', perfumeId: null });
  });
});
