export type ReadingOutcome = 'reading' | 'done' | 'failed' | 'slow';

export const READING_GIVE_UP_MS = 5 * 60_000;

/**
 * Where a "Read again" stands, from the scan row polled after the tap. `before` is the row's
 * updated_at at the tap (both server clock); an unchanged row is the old read still showing.
 */
export function readingOutcome(scan: { status: string; updated_at: string } | null, before: string, elapsedMs: number): ReadingOutcome {
  if (!scan) return 'done';
  const changed = Date.parse(scan.updated_at) > Date.parse(before);
  if (changed && scan.status === 'failed') return 'failed';
  if (changed && (scan.status === 'extracted' || scan.status === 'reviewed')) return 'done';
  return elapsedMs > READING_GIVE_UP_MS ? 'slow' : 'reading';
}
