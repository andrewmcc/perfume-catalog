type Row = { status: string; scan_results: { status: string }[] };

/**
 * How many things wait in Review, counted exactly as the Review page lists them: each pending
 * result, plus each scan that failed or was read with nothing pending (shown under "Couldn't read").
 */
export function countToReview(scans: Row[]): number {
  return scans.reduce((n, s) => {
    const pending = s.status === 'failed' ? 0 : s.scan_results.filter((r) => r.status === 'pending').length;
    return n + (pending || 1);
  }, 0);
}
