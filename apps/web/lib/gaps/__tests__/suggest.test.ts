import { describe, expect, it, vi } from 'vitest';
import type { Gap } from '@perfume/core';
import { QuotaError, suggestFor } from '../suggest-core';

const gap: Gap = { id: 'hot_days', title: 'Nothing fresh or aquatic for hot days', count: 1, total: 9 };
const pick = { house: 'Acqua di Parma', name: 'Fico di Amalfi', concentration: 'edt', why: 'Bright citrus fig' };

describe('suggestFor', () => {
  it('claims the quota before asking the model', async () => {
    const suggest = vi.fn().mockResolvedValue([pick]);
    expect(await suggestFor(gap, [], { claim: async () => true, suggest })).toEqual([pick]);
    expect(suggest).toHaveBeenCalledOnce();
  });
  it('a refused claim throws QuotaError and never calls the model', async () => {
    const suggest = vi.fn();
    await expect(suggestFor(gap, [], { claim: async () => false, suggest })).rejects.toBeInstanceOf(QuotaError);
    expect(suggest).not.toHaveBeenCalled();
  });
});

describe('currentGap', () => {
  it('only a gap the owned perfumes actually have', async () => {
    const { currentGap } = await import('../suggest-core');
    const r = (family: string, seasons: string[]) =>
      ({ perfumeId: family + seasons.join(), house: 'H', name: 'N', concentration: null, family, sillage: null, seasons, times: [], occasions: [], accords: [], notes: { top: [], heart: [], base: [] }, weight: null, thumb: null, items: [{ id: 'i', format: 'full', size_ml: 50, status: 'owned', setId: null, setName: null }], wear: { count: 0, avgRating: null, lastWorn: null } }) as never;
    const rows = [r('oriental', ['winter']), r('oriental', ['autumn']), r('woody', ['winter']), r('leather', ['winter']), r('spicy', ['winter'])];
    expect(currentGap(rows, 'hot_days')).toMatchObject({ id: 'hot_days', count: 0, total: 5 });
    expect(currentGap(rows, 'cold_days')).toBeNull();
  });
});
