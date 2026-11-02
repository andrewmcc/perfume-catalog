import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';

export const LOOKUP_COOLDOWN_MS = 24 * 3600 * 1000;

/**
 * Claims today's lookup for a perfume (service role). True for at most one caller per perfume per
 * day: the conditional update is atomic, so parallel taps can't both spend a web search.
 */
export async function claimLookup(db: SupabaseClient<Database>, perfumeId: string, now = new Date()): Promise<boolean> {
  const cutoff = new Date(now.getTime() - LOOKUP_COOLDOWN_MS).toISOString();
  const { data, error } = await db
    .from('perfumes')
    .update({ lookup_at: now.toISOString() })
    .eq('id', perfumeId)
    .or(`lookup_at.is.null,lookup_at.lt.${cutoff}`)
    .select('id');
  if (error) throw error;
  return data.length === 1;
}
