import type { PerfumeRead } from '@perfume/core';
import { CONCENTRATION_LABEL } from './edits';

/** House in small capitals, name in Bodoni, then concentration and size. */
export function PerfumeLines({ read }: { read: PerfumeRead }) {
  const meta = [read.concentration && CONCENTRATION_LABEL[read.concentration], read.flanker_or_edition, read.size_ml && `${read.size_ml} ml`].filter(Boolean).join(' · ');
  return (
    <div className="min-w-0">
      <p className="text-[12px] tracking-[0.14em] text-muted uppercase">{read.house ?? 'House unknown'}</p>
      <p className="font-display text-[19px] leading-snug text-ink">{read.name ?? 'Name unknown'}</p>
      {meta && <p className="text-sm text-muted">{meta}</p>}
    </div>
  );
}
