export type Weight = 'top' | 'heart' | 'base';

/** Where a perfume's weight sits: the tier with most notes; ties go to the heavier tier. */
export function pyramidWeight(n: { notes_top: string[]; notes_heart: string[]; notes_base: string[] }): Weight | null {
  const counts: [Weight, number][] = [
    ['base', n.notes_base.length],
    ['heart', n.notes_heart.length],
    ['top', n.notes_top.length],
  ];
  const [tier, count] = counts.reduce((best, c) => (c[1] > best[1] ? c : best));
  return count > 0 ? tier : null;
}
