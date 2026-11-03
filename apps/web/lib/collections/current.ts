import type { createServerClient } from '@perfume/supabase';

type Client = ReturnType<typeof createServerClient>;

/** The signed-in member's collection: their first membership by created_at. RLS limits rows to their own. */
export async function getCurrentCollectionId(supabase: Client): Promise<string | null> {
  // Claims are verified locally against the project's signing keys (no Auth round trip).
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;
  const { data, error } = await supabase
    .from('collection_members')
    .select('collection_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.collection_id ?? null;
}
