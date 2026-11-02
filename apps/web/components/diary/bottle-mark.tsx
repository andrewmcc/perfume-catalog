/** A small flacon, filled with the family colour. */
export function BottleMark({ colour, size = 14 }: { colour: string; size?: number }) {
  return (
    <svg viewBox="0 0 10 14" width={(size * 10) / 14} height={size} aria-hidden="true">
      <rect x="3.5" y="0.5" width="3" height="2.5" rx="0.5" fill="var(--color-gold-deep)" />
      <rect x="1" y="3.5" width="8" height="10" rx="1.5" fill={colour} />
    </svg>
  );
}
