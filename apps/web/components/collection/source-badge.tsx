import type { Source } from '@perfume/core';

const COPY: Record<Source, string> = { label: 'From label', ai: 'AI-suggested', edited: 'Edited', text: 'From text' };
const TONE: Record<Source, string> = {
  label: 'border-line text-muted',
  ai: 'border-gold-deep/60 text-gold-deep',
  edited: 'border-oxblood/60 text-oxblood',
  text: 'border-line text-muted italic',
};

/** Where a shown value came from. */
export function SourceBadge({ source }: { source: Source | null }) {
  if (!source) return null;
  return <span className={`rounded-full border px-1.5 py-px text-[11px] whitespace-nowrap ${TONE[source]}`}>{COPY[source]}</span>;
}
