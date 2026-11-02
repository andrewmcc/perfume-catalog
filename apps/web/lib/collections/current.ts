import type { createServerClient } from '@perfume/supabase';

type Client = ReturnType<typeof createServerClient>;

/** The signed-in member's collection: their first membership by created_at. RLS limits rows to their own. */
export async function getCurrentCollectionId(supabase: Client): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('collection_members')
    .select('collection_id')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.collection_id ?? null;
}
