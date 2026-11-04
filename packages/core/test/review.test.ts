import { describe, expect, it } from 'vitest';
import { approveInput, reviewFlags, runBatch, setHouseEdits, type PerfumeRead } from '../src/index.js';

const read = (over: Partial<PerfumeRead> = {}): PerfumeRead => ({
  house: 'Xerjoff',
  name: 'Naxos',
  concentration: 'edp',
  flanker_or_edition: null,
  size_ml: 50,
  status: { house: 'clear', name: 'clear', concentration: 'clear' },
  alternatives: [],
  identified_from: 'label',
  ...over,
});

describe('reviewFlags', () => {
  it('clear read with a match and no duplicate is confident', () => {
    expect(reviewFlags({ read: read(), perfumeId: 'p1', duplicate: false })).toEqual([]);
  });
  it('unclear name flags unclear', () => {
    expect(reviewFlags({ read: read({ status: { house: 'clear', name: 'unclear', concentration: 'clear' } }), perfumeId: 'p1', duplicate: false })).toEqual(['unclear']);
  });
  it('missing house flags unclear', () => {
    expect(reviewFlags({ read: read({ house: null }), perfumeId: 'p1', duplicate: false })).toEqual(['unclear']);
  });
  it('alternatives alone flag unclear', () => {
    expect(reviewFlags({ read: read({ alternatives: ['Naxos Intense'] }), perfumeId: 'p1', duplicate: false })).toEqual(['unclear']);
  });
  it('duplicate flags duplicate', () => {
    expect(reviewFlags({ read: read(), perfumeId: 'p1', duplicate: true })).toEqual(['duplicate']);
  });
  it('no match from a clear label is confident', () => {
    expect(reviewFlags({ read: read(), perfumeId: null, duplicate: false })).toEqual([]);
  });
  it('no match identified from shape flags new', () => {
    expect(reviewFlags({ read: read({ identified_from: 'shape' }), perfumeId: null, duplicate: false })).toEqual(['new']);
  });
});

describe('approveInput', () => {
  it('a wishlist choice is sent as status, not as an edit', () => {
    expect(approveInput(read(), { status: 'wishlist' })).toEqual({ status: 'wishlist', edited_fields: [] });
  });
  it('unchanged read sends nothing', () => {
    expect(approveInput(read(), {})).toEqual({ edited_fields: [] });
    expect(approveInput(read(), { name: 'Naxos', house: 'Xerjoff' })).toEqual({ edited_fields: [] });
  });
  it('a changed name is sent and listed', () => {
    expect(approveInput(read(), { name: 'Naxos Intense' })).toEqual({ name: 'Naxos Intense', edited_fields: ['name'] });
  });
  it('choosing an alternative is a name edit', () => {
    expect(approveInput(read({ alternatives: ['Erba Pura'] }), { name: 'Erba Pura' })).toEqual({ name: 'Erba Pura', edited_fields: ['name'] });
  });
  it('set and item fields are sent when given', () => {
    expect(approveInput(read(), { set_name: 'Discovery', format: 'travel', size_ml: 10 })).toEqual({
      set_name: 'Discovery',
      format: 'travel',
      size_ml: 10,
      edited_fields: ['size_ml'],
    });
  });
});

describe('runBatch', () => {
  it('keeps going past failures and reports them', async () => {
    const seen: number[] = [];
    const out = await runBatch([1, 2, 3, 4, 5], async (n) => {
      seen.push(n);
      if (n % 2 === 0) throw new Error(`bad ${n}`);
    });
    expect(seen).toEqual([1, 2, 3, 4, 5]);
    expect(out.ok).toEqual([1, 3, 5]);
    expect(out.failed).toEqual([
      { item: 2, error: 'bad 2' },
      { item: 4, error: 'bad 4' },
    ]);
  });
});

describe('setHouseEdits', () => {
  const vial = (house: string | null) =>
    ({ house, name: 'Myth', concentration: 'edp', flanker_or_edition: null, size_ml: 2, status: { house: house ? 'clear' : 'absent', name: 'clear', concentration: 'clear' }, alternatives: [], identified_from: 'label' }) as PerfumeRead;

  it('a vial with no house of its own takes the set’s house', () => {
    expect(setHouseEdits(vial(null), {}, 'Björk & Berries')).toEqual({ house: 'Björk & Berries' });
  });
  it('leaves a vial that has its own house, or a house the reviewer typed', () => {
    expect(setHouseEdits(vial('Penhaligon’s'), {}, 'Other')).toEqual({});
    expect(setHouseEdits(vial(null), { house: 'Typed' }, 'Set')).toEqual({ house: 'Typed' });
  });
  it('does nothing without a set house', () => {
    expect(setHouseEdits(vial(null), {}, '  ')).toEqual({});
  });
  it('approves: the filled house reaches the approve input', () => {
    expect(approveInput(vial(null), setHouseEdits(vial(null), {}, 'Set House')).house).toBe('Set House');
  });
});
