import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';

export type AiKind = 'identify' | 'gap_suggest' | 'pair_reasons';

/** Calls per collection per rolling day. */
export const AI_CAPS: Record<AiKind, number> = { identify: 30, gap_suggest: 10, pair_reasons: 60 };

/** Claims one AI call (service-role client). False when the collection's daily cap is reached. */
export async function claimAi(db: SupabaseClient<Database>, collectionId: string, kind: AiKind, now = new Date(), cap = AI_CAPS[kind]): Promise<boolean> {
  const { data, error } = await db.rpc('claim_ai', { p_collection: collectionId, p_kind: kind, p_cap: cap, p_now: now.toISOString() });
  if (error) throw error;
  return data === true;
}
