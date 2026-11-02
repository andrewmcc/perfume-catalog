import type { PerfumeRead } from '../extraction/normalize.js';

export type Flag = 'unclear' | 'duplicate' | 'new';

export const FLAG_COPY: Record<Flag, string> = {
  unclear: 'Hard to read',
  duplicate: 'Already on your shelf',
  new: 'New to the catalogue',
};

/** Why a result needs a human look. An empty list means it can be bulk-approved. */
export function reviewFlags(r: { read: PerfumeRead; perfumeId: string | null; duplicate: boolean }): Flag[] {
  const { read } = r;
  const flags: Flag[] = [];
  if (!read.house || !read.name || read.status.house !== 'clear' || read.status.name !== 'clear' || read.alternatives.length > 0) {
    flags.push('unclear');
  }
  if (r.duplicate) flags.push('duplicate');
  if (!r.perfumeId && read.identified_from !== 'label') flags.push('new');
  return flags;
}
