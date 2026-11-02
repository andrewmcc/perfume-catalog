import type { PerfumeRead } from '../extraction/normalize.js';

export type ReadEdits = Partial<{
  house: string;
  name: string;
  concentration: string | null;
  flanker: string | null;
  size_ml: number | null;
  format: string;
  batch_code: string | null;
  set_house: string;
  set_name: string;
}>;

const norm = (v: unknown) => (typeof v === 'string' ? v.trim() || null : (v ?? null));

/**
 * The approve_result input for a reviewer's edits: read-backed fields only when they differ from
 * the read (listed in edited_fields); item and set fields whenever given. The server re-derives
 * edited fields itself, so edited_fields is informational.
 */
export function approveInput(read: PerfumeRead, edits: ReadEdits): Record<string, unknown> {
  const fromRead: Record<string, unknown> = {
    house: read.house,
    name: read.name,
    concentration: read.concentration,
    flanker: read.flanker_or_edition,
    size_ml: read.size_ml,
  };
  const input: Record<string, unknown> = {};
  const edited: string[] = [];
  for (const [k, v] of Object.entries(edits)) {
    if (v === undefined) continue;
    if (k in fromRead) {
      if (norm(v) === norm(fromRead[k])) continue;
      edited.push(k);
    }
    input[k] = v;
  }
  return { ...input, edited_fields: edited };
}
