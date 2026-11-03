import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@perfume/supabase';
import { IDENTIFY_TEXT_MAX, identifyPerfume } from '@perfume/core';
import { claimAi } from '@/lib/ai/quota';
import { getCurrentCollectionId } from '@/lib/collections/current';
import { createServerClient } from '@/lib/supabase/server';

export const maxDuration = 60;

/**
 * Which perfume typed text means: Claude from memory, then the collection's own match.
 * Answers { proposal: null } when unknown. Counts against the collection's daily identify quota.
 */
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const collectionId = await getCurrentCollectionId(supabase);
  if (!collectionId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > IDENTIFY_TEXT_MAX) return Response.json({ error: 'Type a house and a perfume name.' }, { status: 400 });
  if (!(await claimAi(createServiceClient(), collectionId, 'identify'))) return Response.json({ error: 'That’s enough lookups for today. Try again tomorrow.' }, { status: 429 });

  let proposal;
  try {
    proposal = await identifyPerfume(new Anthropic({ timeout: 30_000, maxRetries: 1 }), text);
  } catch (e) {
    console.error('identify', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Couldn’t look that up just now. Try again.' }, { status: 502 });
  }
  if (!proposal) return Response.json({ proposal: null });

  const { data: perfumeId, error } = await supabase.rpc('find_perfume', {
    p_collection: collectionId,
    p_house: proposal.house,
    p_name: proposal.name,
    p_conc: proposal.concentration ?? '',
    p_flanker: proposal.flanker ?? '',
  });
  if (error) throw error;
  let onShelf: string | null = null;
  if (perfumeId) {
    const { data: items } = await supabase.from('items').select('status').eq('perfume_id', perfumeId);
    onShelf = items?.some((i) => i.status === 'owned') ? 'owned' : items?.some((i) => i.status === 'wishlist') ? 'wishlist' : null;
  }
  return Response.json({ proposal: { ...proposal, perfumeId: (perfumeId as string | null) ?? null, onShelf } });
}
