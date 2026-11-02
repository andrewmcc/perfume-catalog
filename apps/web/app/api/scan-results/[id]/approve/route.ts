import { after } from 'next/server';
import { enrichPerfume } from '@/lib/perfumes/enrich';
import { createServerClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Approves one scan result as the signed-in member (approve_result checks membership and state). */
// Enrichment runs in after(): memory, then web search when that gives no notes (see ENRICH_SEARCH_TIMEOUT_MS).
export const maxDuration = 300;

export async function POST(request: Request, ctx: RouteContext<'/api/scan-results/[id]/approve'>) {
  const { id } = await ctx.params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!UUID.test(id)) return Response.json({ error: 'result not pending' }, { status: 409 });

  const body = (await request.json().catch(() => ({}))) as { input?: unknown };
  const input = body.input && typeof body.input === 'object' && !Array.isArray(body.input) ? body.input : {};
  const { data, error } = await supabase.rpc('approve_result', { p_result_id: id, p_input: input as never });
  if (error || !data?.[0]) return Response.json({ error: error?.message ?? 'approve failed' }, { status: 409 });

  const { item_id, created_perfume_id } = data[0];
  if (created_perfume_id) after(() => enrichPerfume(created_perfume_id));
  return Response.json({ itemId: item_id });
}
