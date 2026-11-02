import { isStuck } from '@perfume/core';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Mirrors private.scan_paths_ok: one or two photos, exactly `${collectionId}/${scanId}/photo-[12].jpg`. */
export function pathsOk(collectionId: string, scanId: string, paths: string[]): boolean {
  if (!new RegExp(`^${UUID}$`, 'i').test(collectionId) || !new RegExp(`^${UUID}$`, 'i').test(scanId)) return false;
  if (paths.length < 1 || paths.length > 2) return false;
  const exact = new RegExp(`^${collectionId}/${scanId}/photo-[12]\\.jpg$`);
  return paths.every((p) => exact.test(p));
}

const MAX_SWEEP = 20;

/** Stuck scans only, oldest first, at most 20. */
export function selectPending<T extends { status: string; updated_at: string }>(rows: T[], now: Date): T[] {
  return rows
    .filter((r) => isStuck(r, now))
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .slice(0, MAX_SWEEP);
}
