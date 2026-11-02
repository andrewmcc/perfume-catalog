import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';

/** Web lookups a collection may start per day (each ~15–20p). */
export const LOOKUPS_PER_DAY = 20;

/**
 * Claims a "Look up notes" for a perfume (service role only). False when this perfume was looked
 * up in the last day or the collection has used its daily lookups. Atomic per collection.
 */
export async function claimLookup(db: SupabaseClient<Database>, collectionId: string, perfumeId: string, now = new Date(), cap = LOOKUPS_PER_DAY): Promise<boolean> {
  const { data, error } = await db.rpc('claim_lookup', { p_collection: collectionId, p_perfume: perfumeId, p_now: now.toISOString(), p_daily_cap: cap });
  if (error) throw error;
  return data === true;
}
