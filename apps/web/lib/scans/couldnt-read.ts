type Scan = { mode: string; status: string; error: string | null; set: { house: string | null; name: string | null } | null };

/**
 * Why a scan sits in Couldn't read, and whether Read again can help: only a failed read can.
 * A finished read of the same photo gives the same answer (and costs a call).
 */
export function couldntRead(s: Scan): { text: string; readAgain: boolean } {
  if (s.status === 'failed') return { text: s.error ?? 'Nothing could be read from this photo.', readAgain: true };
  const box = [s.set?.house, s.set?.name].filter(Boolean).join(' ').replaceAll("'", '’');
  if (s.mode === 'set' && box) {
    return { text: `Read the box (${box}), but no scent names were in the photo. Add them, or scan again with the box open.`, readAgain: false };
  }
  if (s.mode === 'set') return { text: 'Couldn’t tell which set this is. Type its house, then suggest the usual scents or add them.', readAgain: false };
  return { text: 'Nothing could be read from this photo.', readAgain: false };
}
