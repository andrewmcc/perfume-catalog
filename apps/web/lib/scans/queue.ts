import 'server-only';
import { reviewFlags, type Flag, type Mode, type PerfumeRead } from '@perfume/core';
import type { createServerClient } from '@perfume/supabase';

type Client = ReturnType<typeof createServerClient>;

export type QueueResult = { id: string; kind: 'bottle' | 'vial' | 'set_scent'; read: PerfumeRead; flags: Flag[] };
export type QueueScan = {
  id: string;
  mode: Mode;
  status: 'extracted' | 'failed';
  /** Failed, or extracted with nothing read: offered Read again / Dismiss. */
  couldntRead: boolean;
  error: string | null;
  photos: string[];
  set: { house: string | null; name: string | null } | null;
  bottle: { format: string; batch_code: string | null } | null;
  results: QueueResult[];
  created_at: string;
};

const PHOTO_TTL_S = 3600;

/** The member's scans awaiting review, with signed photo URLs and flags. Flagged first, then oldest. */
export async function loadQueue(supabase: Client): Promise<QueueScan[]> {
  const { data: scans, error } = await supabase
    .from('scans')
    .select('id, mode, status, error, photo_paths, extraction, created_at, scan_results(id, kind, read, status, position)')
    .in('status', ['extracted', 'failed'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  if (!scans.length) return [];

  const extractedIds = scans.filter((s) => s.status === 'extracted').map((s) => s.id);
  const lookup = new Map<string, { perfume_id: string | null; duplicate: boolean }>();
  if (extractedIds.length) {
    const { data, error: lErr } = await supabase.rpc('review_lookup', { p_scan_ids: extractedIds });
    if (lErr) throw lErr;
    for (const r of data) lookup.set(r.result_id, r);
  }

  const paths = scans.flatMap((s) => s.photo_paths);
  const { data: signed, error: sErr } = await supabase.storage.from('photos').createSignedUrls(paths, PHOTO_TTL_S);
  if (sErr) throw sErr;
  const url = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const queue = scans.map((s): QueueScan => {
    const results = s.scan_results
      .filter((r) => r.status === 'pending')
      .sort((x, y) => x.position - y.position)
      .map((r) => {
        const read = r.read as unknown as PerfumeRead;
        const l = lookup.get(r.id);
        return { id: r.id, kind: r.kind as QueueResult['kind'], read, flags: reviewFlags({ read, perfumeId: l?.perfume_id ?? null, duplicate: l?.duplicate ?? false }) };
      });
    const ext = (s.extraction ?? {}) as { set_house?: string | null; set_name?: string | null; format?: string; batch_code?: string | null };
    return {
      id: s.id,
      mode: s.mode as Mode,
      status: s.status as QueueScan['status'],
      couldntRead: s.status === 'failed' || results.length === 0,
      error: s.error,
      photos: s.photo_paths.map((p) => url.get(p)).filter((u): u is string => !!u),
      set: s.mode === 'set' ? { house: ext.set_house ?? null, name: ext.set_name ?? null } : null,
      bottle: s.mode === 'bottle' ? { format: ext.format ?? 'full', batch_code: ext.batch_code ?? null } : null,
      results,
      created_at: s.created_at,
    };
  });
  const flagged = (s: QueueScan) => s.results.some((r) => r.flags.length > 0);
  return queue.sort((x, y) => Number(flagged(y)) - Number(flagged(x)) || x.created_at.localeCompare(y.created_at));
}

/** How many things wait in review: pending results plus scans that couldn't be read. */
export async function reviewCount(supabase: Client): Promise<number> {
  const [results, failed] = await Promise.all([
    supabase.from('scan_results').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('scans').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
  ]);
  return (results.count ?? 0) + (failed.count ?? 0);
}
