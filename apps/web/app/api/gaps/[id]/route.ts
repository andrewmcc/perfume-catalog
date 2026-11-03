import { isGapId } from '@perfume/core';
import { loadCollection } from '@/lib/collection/load';
import { getCurrentCollectionId } from '@/lib/collections/current';
import { QuotaError, gapSuggestions } from '@/lib/gaps/suggest';
import { currentGap } from '@/lib/gaps/suggest-core';
import { createServerClient } from '@/lib/supabase/server';

export const maxDuration = 60;

/** AI suggestions for one gap in the member's owned perfumes. */
export async function GET(_request: Request, ctx: RouteContext<'/api/gaps/[id]'>) {
  const { id } = await ctx.params;
  const supabase = await createServerClient();
  const collectionId = await getCurrentCollectionId(supabase);
  if (!collectionId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!isGapId(id)) return Response.json({ error: 'not found' }, { status: 404 });

  const { rows } = await loadCollection(supabase, { thumbs: false });
  const gap = currentGap(rows, id);
  if (!gap) return Response.json({ error: 'That gap is filled now.' }, { status: 404 });
  // Wishlist perfumes are left out of suggestions too.
  const known = rows.map((r) => ({ house: r.house, name: r.name })).sort((a, b) => `${a.house}|${a.name}`.localeCompare(`${b.house}|${b.name}`));
  try {
    return Response.json({ suggestions: await gapSuggestions(collectionId, gap, known) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof QuotaError || msg.includes('quota used up')) return Response.json({ error: 'That’s enough suggestions for today. Try again tomorrow.' }, { status: 429 });
    console.error('gap suggestions', msg);
    return Response.json({ error: 'Couldn’t get suggestions just now. Try again.' }, { status: 502 });
  }
}

