const canon = (v: unknown): unknown => {
  if (v === undefined || v === null || v === '') return null;
  if (Array.isArray(v)) return v.length === 0 ? null : JSON.stringify([...v].map(String).sort());
  return typeof v === 'string' ? v.trim() : v;
};

/**
 * New item overrides after fact edits: an edit that differs from the perfume's own value is stored;
 * one that matches it removes the override (back to the source). Other keys are kept.
 */
export function overridePatch(current: Record<string, unknown>, perfume: Record<string, unknown>, edits: Record<string, unknown>): Record<string, unknown> {
  const next = { ...current };
  for (const [k, v] of Object.entries(edits)) {
    if (canon(v) === canon(perfume[k])) delete next[k];
    else next[k] = v;
  }
  return next;
}
