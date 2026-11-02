type Weight = 'top' | 'heart' | 'base' | null;

// Tier shapes inside a 34x30 box: apex (17,1), base corners (1,29) and (33,29), dividers at y=11 and y=20.
const TIERS = {
  top: { d: 'M17 1 11.3 11h11.4Z', fill: 'var(--color-gold)' },
  heart: { d: 'M11.3 11 6.1 20h21.8l-5.2-9Z', fill: 'var(--color-rose)' },
  base: { d: 'M6.1 20 1 29h32l-5.1-9Z', fill: 'var(--color-oxblood)' },
} as const;

const LABEL = { top: 'Top notes', heart: 'Heart notes', base: 'Base notes' } as const;

/** The scent pyramid. The filled tier shows where a perfume's weight sits; null draws the outline only. */
export function ScentPyramid({ weight, size = 36 }: { weight: Weight; size?: number }) {
  return (
    <svg
      viewBox="0 0 34 30"
      width={size}
      height={(size * 30) / 34}
      role="img"
      aria-label={weight ? `Weighted to ${LABEL[weight].toLowerCase()}` : 'Scent pyramid'}
      className="shrink-0"
    >
      {weight && <path d={TIERS[weight].d} fill={TIERS[weight].fill} />}
      <path d="M17 1 33 29H1Z" fill="none" stroke="var(--color-oxblood)" strokeWidth="1" strokeLinejoin="round" />
      <path d="M11.3 11h11.4M6.1 20h21.8" stroke="var(--color-oxblood)" strokeWidth="1" />
    </svg>
  );
}
