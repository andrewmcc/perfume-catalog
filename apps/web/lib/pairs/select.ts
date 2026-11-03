import { layerWith, pairFromRow, smellsLike, type CollectionRow, type Pair, type PairPerfume } from '@perfume/core';

export type Pairs = { target: PairPerfume; likes: Pair[]; layers: Pair[] };

/** Smells like and layer with for one perfume, from the perfumes the collection owns. Null if the perfume isn't in the rows. */
export function pairsFor(rows: CollectionRow[], perfumeId: string): Pairs | null {
  const row = rows.find((r) => r.perfumeId === perfumeId);
  if (!row) return null;
  const target = pairFromRow(row);
  const others = rows.filter((r) => r.perfumeId !== perfumeId && r.items.some((i) => i.status === 'owned')).map(pairFromRow);
  const likes = smellsLike(target, others);
  const layers = layerWith(target, others, new Set(likes.map((p) => p.perfume.perfumeId)));
  return { target, likes, layers };
}
