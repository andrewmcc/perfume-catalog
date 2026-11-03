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
