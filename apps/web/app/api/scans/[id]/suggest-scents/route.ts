import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@perfume/supabase';
import { suggestSetContents } from '@perfume/core';
import { claimAi } from '@/lib/ai/quota';
import { setIdentity } from '@/lib/scans/set-identity';
import { createServerClient } from '@/lib/supabase/server';

export const maxDuration = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * For a set scan whose box was read but showed no scents: Claude suggests the set's usual scents,
 * added as pending results flagged Suggested. Body { set_house, set_name } corrects the box read
 * (saved on the scan). Counts against the daily identify quota.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/scans/[id]/suggest-scents'>) {
  const { id } = await ctx.params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!UUID.test(id)) return Response.json({ error: 'not found' }, { status: 404 });

  // Member's view (RLS): only their collection's scans are visible.
  const { data: scan } = await supabase.from('scans').select('id, collection_id, mode, status, extraction, scan_results(status)').eq('id', id).maybeSingle();
  if (!scan) return Response.json({ error: 'not found' }, { status: 404 });
  const ext = (scan.extraction ?? {}) as Record<string, unknown> & { set_house?: string | null; set_name?: string | null };
  const { house, name, changed } = setIdentity(ext, await request.json().catch(() => null));
  if (scan.mode !== 'set' || scan.status !== 'extracted') return Response.json({ error: 'Only for a set scan awaiting review.' }, { status: 409 });
  if (!house) return Response.json({ error: 'Type the set’s house first.' }, { status: 400 });
  if (scan.scan_results.some((r) => r.status === 'pending')) return Response.json({ error: 'This set already has scents to review.' }, { status: 409 });

  const admin = createServiceClient();
  // Keep the correction, so the card shows it after a reload and approval names the set right.
  if (changed) {
    const { error } = await admin.from('scans').update({ extraction: { ...ext, set_house: house, set_name: name } as never }).eq('id', scan.id);
    if (error) console.error('suggest-scents save set', error.message);
  }
  if (!(await claimAi(admin, scan.collection_id, 'identify'))) return Response.json({ error: 'That’s enough lookups for today. Try again tomorrow.' }, { status: 429 });

  let reads;
  try {
    reads = await suggestSetContents(new Anthropic({ timeout: 100_000, maxRetries: 1 }), { house, name });
  } catch (e) {
    console.error('suggest-scents', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Couldn’t look the set up just now. Try again.' }, { status: 502 });
  }
  if (!reads.length) return Response.json({ added: 0 });

  const start = scan.scan_results.length;
  const { error } = await admin.from('scan_results').insert(
    reads.map((read, i) => ({ scan_id: scan.id, collection_id: scan.collection_id, position: start + i, kind: 'set_scent', read: read as never })),
  );
  if (error) {
    console.error('suggest-scents insert', error.message);
    return Response.json({ error: 'Couldn’t save the suggestions. Try again.' }, { status: 500 });
  }
  return Response.json({ added: reads.length });
}
