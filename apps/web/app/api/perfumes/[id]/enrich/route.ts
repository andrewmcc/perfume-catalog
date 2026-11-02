import { createServiceClient } from '@perfume/supabase';
import { enrichPerfume, rowHasNotes } from '@/lib/perfumes/enrich';
import { claimLookup } from '@/lib/perfumes/lookup';
import { createServerClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const maxDuration = 300;

/**
 * "Look up notes" for a perfume that has none: memory, then web search. Only for a perfume the
 * member's collection has an item of, only while it has no notes, and once per perfume per day.
 */
export async function POST(_request: Request, ctx: RouteContext<'/api/perfumes/[id]/enrich'>) {
  const { id } = await ctx.params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!UUID.test(id)) return Response.json({ error: 'not found' }, { status: 404 });

  // RLS: the member sees only their collection's items and visible perfumes.
  const [{ data: item }, { data: p }] = await Promise.all([
    supabase.from('items').select('id').eq('perfume_id', id).limit(1).maybeSingle(),
    supabase.from('perfumes').select('notes_top, notes_heart, notes_base').eq('id', id).maybeSingle(),
  ]);
  if (!item || !p) return Response.json({ error: 'not found' }, { status: 404 });
  if (rowHasNotes(p)) return Response.json({ found: true });
  if (!(await claimLookup(createServiceClient(), id))) return Response.json({ error: 'Already looked up today. Try again tomorrow.' }, { status: 429 });

  await enrichPerfume(id);
  const { data: after } = await supabase.from('perfumes').select('notes_top, notes_heart, notes_base').eq('id', id).single();
  return Response.json({ found: !!after && rowHasNotes(after) });
}
