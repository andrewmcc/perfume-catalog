import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { cacheLife } from 'next/cache';
import { createServiceClient } from '@perfume/supabase';
import { suggestForGap, type Gap, type GapSuggestion } from '@perfume/core';
import { claimAi } from '@/lib/ai/quota';
import { suggestFor } from './suggest-core';

export { QuotaError } from './suggest-core';

/**
 * Suggestions for a gap, cached per collection, gap and owned list (the arguments are the key).
 * The quota is claimed only on a miss; errors (including QuotaError) aren't cached.
 */
export async function gapSuggestions(collectionId: string, gap: Gap, owned: { house: string; name: string }[]): Promise<GapSuggestion[]> {
  // Shared across instances: a cold instance shouldn't re-ask (and re-pay for) an answer already cached.
  'use cache: remote';
  cacheLife('days');
  return suggestFor(gap, owned, {
    claim: () => claimAi(createServiceClient(), collectionId, 'gap_suggest'),
    suggest: (g, o) => suggestForGap(new Anthropic({ timeout: 45_000, maxRetries: 1 }), g, o),
  });
}
