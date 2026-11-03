import { useId } from 'react';

// The glass: rounded shoulders, flat base. Liquid and the wave are clipped to it.
const GLASS = 'M-22 -14C-22 -22 -16 -26 -8 -26H8C16 -26 22 -22 22 -14V32C22 38 18 42 12 42H-12C-18 42 -22 38 -22 32Z';
// Two wave periods (40 units each) so a 40-unit slide loops seamlessly.
const WAVE = 'M-62 4Q-52 -2 -42 4T-22 4T-2 4T18 4T38 4T58 4T78 4V60H-62Z';
const MIST = [
  [14, -50, 2.6],
  [21, -57, 2.1],
  [27, -63, 1.6],
] as const;

/**
 * Suspense fallback and pending marker: a flacon whose scent laps behind the glass while mist
 * puffs from the atomiser in turn. `sm` is the inline size; the label is the accessible status.
 */
export function LoadingFlacon({ label, size = 'md', className = '' }: { label: string; size?: 'sm' | 'md'; className?: string }) {
  const clip = useId();
  const sm = size === 'sm';
  return (
    <div role="status" className={sm ? `inline-flex items-center gap-2 text-sm text-muted ${className}` : `flex flex-col items-center gap-3 pt-16 text-muted ${className}`}>
      <svg viewBox="-36 -70 72 116" width={sm ? 22 : 56} height={sm ? 35 : 90} aria-hidden="true" className="overflow-visible">
        <defs>
          <clipPath id={clip}>
            <path d={GLASS} />
          </clipPath>
        </defs>
        {MIST.map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} className="flacon-mist fill-gold-deep" style={{ animationDelay: `${i * 0.28}s` }} />
        ))}
        <rect x="-11" y="-48" width="22" height="14" rx="2.5" className="fill-gold" />
        <rect x="-11" y="-48" width="22" height="14" rx="2.5" fill="none" strokeWidth="1.5" className="stroke-gold-deep" />
        <path d="M11 -43H15" strokeWidth="2" strokeLinecap="round" className="stroke-gold-deep" />
        <rect x="-6" y="-34" width="12" height="8" className="fill-gold-deep" />
        <path d={GLASS} className="fill-card" />
        <g clipPath={`url(#${clip})`}>
          <g className="flacon-level">
            <path d={WAVE} className="flacon-wave fill-oxblood" opacity="0.85" />
          </g>
        </g>
        <path d={GLASS} fill="none" strokeWidth="2.5" className="stroke-ink" />
        <path d="M-15 -14V22" strokeWidth="2.5" strokeLinecap="round" className="stroke-card" opacity="0.7" />
      </svg>
      <p className={sm ? '' : 'text-sm'}>{label}</p>
    </div>
  );
}
