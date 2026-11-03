import type { Source } from '@perfume/core';

/** One badge for a section (its most common source) and per-row badges only where a row differs. */
export function groupSources(sources: (Source | null)[]): { section: Source | null; row: (Source | null)[] } {
  const counts = new Map<Source, number>();
  for (const s of sources) if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  let section: Source | null = null;
  for (const [s, n] of counts) if (section === null || n > counts.get(section)!) section = s;
  return { section, row: sources.map((s) => (s && s !== section ? s : null)) };
}
