import type { BottleResult, ExtractionResult, PerfumeRead, SamplesResult, SetResult } from './normalize.js';
import type { Mode } from './schema.js';

/** The mode's "is this perfume at all" flag. */
export function isPerfume(mode: Mode, result: ExtractionResult): boolean {
  switch (mode) {
    case 'bottle':
      return (result as BottleResult).is_perfume;
    case 'samples':
      return (result as SamplesResult).is_perfume_photo;
    case 'set':
      return (result as SetResult).is_discovery_set;
  }
}

export type ResultRow = { kind: 'bottle' | 'vial' | 'set_scent'; read: PerfumeRead };

/** One scan_results row per perfume read. The set's own house and name stay on the scan. */
export function resultsToRows(mode: Mode, result: ExtractionResult): ResultRow[] {
  switch (mode) {
    case 'bottle':
      return [{ kind: 'bottle', read: (result as BottleResult).perfume }];
    case 'samples':
      return (result as SamplesResult).vials.map((read) => ({ kind: 'vial', read }));
    case 'set':
      return (result as SetResult).scents.map((read) => ({ kind: 'set_scent', read }));
  }
}

export type NextStatus = { status: 'extracted' | 'discarded' | 'failed' | 'retry'; error?: string };

/** Decides a scan's status after one extraction attempt. A call tries at most twice. */
export function nextStatus(r: { mode: Mode; result: ExtractionResult } | { error: string }, attemptInCall: 1 | 2): NextStatus {
  if ('error' in r) return { status: attemptInCall === 1 ? 'retry' : 'failed', error: r.error };
  return isPerfume(r.mode, r.result) ? { status: 'extracted' } : { status: 'discarded', error: 'not perfume' };
}

const STUCK_MS: Record<string, number> = { uploaded: 2 * 60_000, processing: 10 * 60_000 };

/** An uploaded scan nobody started, or a processing scan whose worker died. */
export function isStuck(scan: { status: string; updated_at: string }, now: Date): boolean {
  const limit = STUCK_MS[scan.status];
  return limit !== undefined && now.getTime() - new Date(scan.updated_at).getTime() > limit;
}
