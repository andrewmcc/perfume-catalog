import type { PerfumeRead } from '../extraction/normalize.js';

export type Flag = 'unclear' | 'suggested' | 'duplicate' | 'new';

export const FLAG_COPY: Record<Flag, string> = {
  unclear: 'Hard to read',
  suggested: 'Suggested: check it’s in your box',
  duplicate: 'Already on your shelf',
  new: 'New to the catalogue',
};

/** Why a result needs a human look. An empty list means it can be bulk-approved. */
export function reviewFlags(r: { read: PerfumeRead; perfumeId: string | null; duplicate: boolean }): Flag[] {
  const { read } = r;
  const flags: Flag[] = [];
  // A scent suggested from what the set usually holds, not read from the photo.
  const suggested = read.identified_from === 'none' && read.status.name === 'unclear';
  if (suggested) flags.push('suggested');
  else if (!read.house || !read.name || read.status.house !== 'clear' || read.status.name !== 'clear' || read.alternatives.length > 0) {
    flags.push('unclear');
  }
  if (r.duplicate) flags.push('duplicate');
  if (!r.perfumeId && read.identified_from !== 'label') flags.push('new');
  return flags;
}
