import type { Weight } from '../collection/pyramid.js';
import type { CollectionRow } from '../collection/row.js';
import { heft } from '../today/score.js';

/** What pairing looks at, per perfume. Notes are lowercased, top → heart → base. */
export type PairPerfume = {
  perfumeId: string;
  house: string;
  name: string;
  family: string | null;
  accords: string[];
  notes: string[];
  weight: Weight | null;
  sillage: string | null;
  sample: boolean;
};

export type PairCode = 'very_close' | 'shares' | 'family' | 'lifts' | 'warms' | 'bridge';
export type Pair = { perfume: PairPerfume; score: number; code: PairCode; shared: string[] };

const VERY_CLOSE = 2.5;
const LIKE_MIN = 1.2;
const LAYER_MIN = 2;

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim().toLowerCase()).filter(Boolean))];

export function pairFromRow(r: CollectionRow): PairPerfume {
  const owned = r.items.filter((i) => i.status === 'owned');
  return {
    perfumeId: r.perfumeId,
    house: r.house,
    name: r.name,
    family: r.family,
    accords: uniq(r.accords),
    notes: uniq([...r.notes.top, ...r.notes.heart, ...r.notes.base]),
    weight: r.weight,
    sillage: r.sillage,
    sample: owned.length > 0 && owned.every((i) => i.format === 'sample'),
  };
}

const jaccard = (a: string[], b: string[]) => {
  if (!a.length || !b.length) return 0;
  const sb = new Set(b);
  const inter = a.filter((x) => sb.has(x)).length;
  return inter / new Set([...a, ...b]).size;
};
/** Items of `a` (in a's order) also in `b`. */
const common = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

/** 3·J(notes) + 2·J(accords) + 1 for the same family. */
export const similarity = (a: PairPerfume, b: PairPerfume) =>
  3 * jaccard(a.notes, b.notes) + 2 * jaccard(a.accords, b.accords) + (a.family && a.family === b.family ? 1 : 0);

const hasProfile = (p: PairPerfume) => p.notes.length + p.accords.length > 0;
const byScore = (x: Pair, y: Pair) => y.score - x.score || x.perfume.name.localeCompare(y.perfume.name);

/** Perfumes that smell like the target: strongest first, at most n. */
export function smellsLike(target: PairPerfume, others: PairPerfume[], n = 3): Pair[] {
  if (!hasProfile(target)) return [];
  return others
    .filter((o) => o.perfumeId !== target.perfumeId)
    .map((o): Pair => {
      const score = similarity(target, o);
      const shared = common(target.notes, o.notes);
      const code: PairCode = score >= VERY_CLOSE ? 'very_close' : shared.length ? 'shares' : 'family';
      return { perfume: o, score, code, shared: shared.slice(0, 3) };
    })
    .filter((p) => p.score >= LIKE_MIN)
    .sort(byScore)
    .slice(0, n);
}

/** Perfumes to layer with the target: a shared note or accord, a contrast in weight or family. */
export function layerWith(target: PairPerfume, others: PairPerfume[], exclude: Set<string>, n = 3): Pair[] {
  if (!hasProfile(target)) return [];
  const th = heft(target);
  return others
    .filter((o) => o.perfumeId !== target.perfumeId && !exclude.has(o.perfumeId))
    .flatMap((o): Pair[] => {
      const shared = [...common(target.notes, o.notes), ...common(target.accords, o.accords)];
      if (!shared.length || similarity(target, o) >= VERY_CLOSE) return [];
      const oh = heft(o);
      const score = Math.min(shared.length, 3) + Math.abs(th - oh) + (target.family && o.family && target.family !== o.family ? 1 : 0);
      if (score < LAYER_MIN) return [];
      const code: PairCode = th >= 1 && oh <= -1 ? 'lifts' : th <= -1 && oh >= 1 ? 'warms' : 'bridge';
      return [{ perfume: o, score, code, shared: shared.slice(0, 3) }];
    })
    .sort(byScore)
    .slice(0, n);
}

const FAMILY_LABEL: Record<string, string> = { fougere: 'fougère' };

/** The rule-written line under a pair. */
export function pairReason(p: Pair, kind: 'like' | 'layer'): string {
  const [a, b] = p.shared;
  if (kind === 'like') {
    if (p.code === 'very_close') return p.shared.length ? `Very close · shares ${p.shared.join(', ')}` : 'Very close';
    if (p.code === 'shares') return `Shares ${p.shared.join(', ')}`;
    return `Also ${FAMILY_LABEL[p.perfume.family ?? ''] ?? p.perfume.family ?? 'similar'}`;
  }
  if (p.code === 'lifts') return `Lifts the heavy base · linked by ${a}`;
  if (p.code === 'warms') return `Adds warmth underneath · linked by ${a}`;
  return b ? `Linked by ${a} and ${b}` : `Linked by ${a}`;
}
