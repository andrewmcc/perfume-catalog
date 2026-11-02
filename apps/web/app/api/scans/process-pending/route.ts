import { after } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { extractScan } from '@/lib/scans/extract-scan';
import { SWEEP_START_BUDGET_MS, runLimited } from '@/lib/scans/budget';
import { scanDeps } from '@/lib/scans/deps';
import { selectPending } from '@/lib/scans/pending';

export const maxDuration = 300; // = ROUTE_MAX_DURATION_S

/** Re-queues the requester's stuck scans (no cron on Hobby: Scan and Today call this on load). */
export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const deps = scanDeps();
  const { data: memberships } = await deps.db.from('collection_members').select('collection_id').eq('user_id', user.id);
  const collections = (memberships ?? []).map((m) => m.collection_id);
  if (!collections.length) return Response.json({ queued: 0 });

  const { data: rows } = await deps.db
    .from('scans')
    .select('id, status, updated_at')
    .in('collection_id', collections)
    .in('status', ['uploaded', 'processing'])
    .order('updated_at', { ascending: true })
    .limit(100);
  const pending = selectPending(rows ?? [], new Date());

  if (pending.length) after(() => runLimited(pending, 3, SWEEP_START_BUDGET_MS, (s) => extractScan(deps, s.id, user.id, 'sweep')));
  return Response.json({ queued: pending.length });
}
