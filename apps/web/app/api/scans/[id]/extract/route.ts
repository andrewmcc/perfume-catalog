import { after } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { extractScan } from '@/lib/scans/extract-scan';
import { scanDeps } from '@/lib/scans/deps';

export const maxDuration = 300; // = ROUTE_MAX_DURATION_S

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Queues extraction of one scan. 404 unless the scan is visible to the member (RLS); the work re-checks with the service role. */
export async function POST(_request: Request, ctx: RouteContext<'/api/scans/[id]/extract'>) {
  const { id } = await ctx.params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!UUID.test(id)) return Response.json({ error: 'not found' }, { status: 404 });

  const { data: scan } = await supabase.from('scans').select('id').eq('id', id).maybeSingle();
  if (!scan) return Response.json({ error: 'not found' }, { status: 404 });

  after(() => extractScan(scanDeps(), id, user.id, 'explicit'));
  return Response.json({ queued: true }, { status: 202 });
}
