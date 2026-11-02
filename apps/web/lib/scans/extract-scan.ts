import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@perfume/supabase';
import { EXTRACTION_MODEL, nextStatus, normalizeResult, resultsToRows, type ExtractionResult, type Mode } from '@perfume/core';
import { pathsOk } from './pending';

export type ExtractFn = (mode: Mode, photos: string[]) => Promise<unknown>;
export type ExtractOutcome = 'not_found' | 'not_claimed' | 'extracted' | 'discarded' | 'failed';

type Deps = { db: SupabaseClient<Database>; extract: ExtractFn };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

/**
 * Extracts one scan with the service role. The scan row is untrusted: the requester must be a member of
 * its collection and every photo path must sit under `${collection_id}/${scan.id}/`, else `not_found` and
 * nothing is read or written. Claims atomically, tries the extract at most twice, and never leaves the
 * scan `processing`.
 */
export async function extractScan({ db, extract }: Deps, scanId: string, requesterId: string, claim: 'explicit' | 'sweep'): Promise<ExtractOutcome> {
  const { data: scan } = await db.from('scans').select('id, collection_id, mode, photo_paths').eq('id', scanId).maybeSingle();
  if (!scan) return 'not_found';
  const { data: member } = await db
    .from('collection_members')
    .select('user_id')
    .eq('collection_id', scan.collection_id)
    .eq('user_id', requesterId)
    .maybeSingle();
  if (!member || !pathsOk(scan.collection_id, scan.id, scan.photo_paths)) return 'not_found';

  const { data: claimed, error: claimError } = await db.rpc('claim_scan', { p_id: scanId, p_claim: claim });
  if (claimError) {
    console.error('extract', scanId, `claim: ${claimError.message}`);
    return 'not_claimed';
  }
  const row = claimed?.[0];
  if (!row) return 'not_claimed';

  const mode = row.mode as Mode;
  let attempts = row.attempts;
  try {
    for (const attemptInCall of [1, 2] as const) {
      if (attemptInCall === 2) {
        attempts += 1;
        await db.from('scans').update({ attempts }).eq('id', scanId);
      }
      let result: ExtractionResult;
      try {
        const photos = await Promise.all(row.photo_paths.map((p) => download(db, p)));
        result = normalizeResult(mode, await extract(mode, photos));
      } catch (e) {
        const next = nextStatus({ error: message(e) }, attemptInCall);
        console.error('extract', scanId, next.error);
        if (next.status === 'retry') continue;
        await finish(db, scanId, { status: 'failed', error: next.error ?? 'failed', extraction: null });
        return 'failed';
      }

      const next = nextStatus({ mode, result }, attemptInCall);
      if (next.status === 'discarded') {
        await finish(db, scanId, { status: 'discarded', error: next.error ?? 'not perfume', extraction: result });
        return 'discarded';
      }
      await replacePendingResults(db, scanId, row.collection_id, mode, result);
      await finish(db, scanId, { status: 'extracted', error: null, extraction: result });
      return 'extracted';
    }
    throw new Error('unreachable');
  } catch (e) {
    // A write failed after the claim: end failed rather than stuck in processing.
    console.error('extract', scanId, message(e));
    await finish(db, scanId, { status: 'failed', error: message(e), extraction: null }).catch((e2) => console.error('extract', scanId, message(e2)));
    return 'failed';
  }
}

async function download(db: SupabaseClient<Database>, path: string): Promise<string> {
  const { data, error } = await db.storage.from('photos').download(path);
  if (error || !data) throw new Error(`download ${path}: ${error?.message ?? 'no data'}`);
  return Buffer.from(await data.arrayBuffer()).toString('base64');
}

async function finish(
  db: SupabaseClient<Database>,
  scanId: string,
  r: { status: 'extracted' | 'discarded' | 'failed'; error: string | null; extraction: ExtractionResult | null },
): Promise<void> {
  const { error } = await db
    .from('scans')
    .update({ status: r.status, error: r.error, extraction: r.extraction as unknown as Json, model: EXTRACTION_MODEL })
    .eq('id', scanId)
    .eq('status', 'processing');
  if (error) throw new Error(`write status: ${error.message}`);
}

/** Re-extraction replaces the scan's pending results; approved or discarded ones (1c) are kept. */
async function replacePendingResults(db: SupabaseClient<Database>, scanId: string, collectionId: string, mode: Mode, result: ExtractionResult): Promise<void> {
  const { error: delError } = await db.from('scan_results').delete().eq('scan_id', scanId).eq('status', 'pending');
  if (delError) throw new Error(`clear results: ${delError.message}`);
  const rows = resultsToRows(mode, result).map((r, position) => ({
    scan_id: scanId,
    collection_id: collectionId,
    position,
    kind: r.kind,
    read: r.read as unknown as Json,
  }));
  if (!rows.length) return;
  const { error } = await db.from('scan_results').insert(rows);
  if (error) throw new Error(`write results: ${error.message}`);
}
