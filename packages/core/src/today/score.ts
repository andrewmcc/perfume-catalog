import type { Weight } from '../collection/pyramid.js';
import { addDays, daysBetween, type Daypart, type Season } from '../time/london.js';

export type Candidate = {
  perfumeId: string;
  itemId: string;
  house: string;
  name: string;
  family: string | null;
  seasons: string[];
  times: string[];
  occasions: string[];
  weight: Weight | null;
  sillage: string | null;
  sample: boolean;
  lastWorn: string | null;
  sizeMl: number | null;
  setName: string | null;
};

export type Nudge = 'lighter' | 'bolder';
export type TodayContext = { date: string; daypart: Daypart; season: Season; tempC: number | null; nudge: Nudge | null; occasion: string | null };

export type ReasonCode =
  | { code: 'untried_sample' | 'season' | 'daypart' | 'occasion' | 'heavy' | 'fresh' | 'weather_fit' }
  | { code: 'neglected'; weeks: number };
export type Pick = { candidate: Candidate; score: number; reasons: ReasonCode[] };

const clamp = (n: number) => Math.max(-2, Math.min(2, n));
const LIGHT_FAMILIES = new Set(['citrus', 'aquatic', 'green']);
const HEAVY_FAMILIES = new Set(['gourmand', 'oriental', 'leather', 'spicy']);

/** How heavy a perfume wears, −2 (light) … 2 (heavy). */
export function heft(c: { family: string | null; weight: Weight | null; sillage: string | null }): number {
  const fam = c.family ? (LIGHT_FAMILIES.has(c.family) ? -1 : HEAVY_FAMILIES.has(c.family) ? 1 : 0) : 0;
  const weight = c.weight === 'top' ? -1 : c.weight === 'base' ? 1 : 0;
  const sillage = c.sillage === 'intimate' ? -1 : c.sillage === 'strong' || c.sillage === 'enormous' ? 1 : 0;
  return clamp(fam + weight + sillage);
}

const tempHeft = (t: number) => (t >= 22 ? -2 : t >= 16 ? -1 : t >= 10 ? 0 : t >= 4 ? 1 : 2);
const SEASON_HEFT: Record<Season, number> = { summer: -1, spring: 0, autumn: 0, winter: 1 };

/** The heft that suits right now: weather (or season), later in the day, then the nudge. */
export function idealHeft(ctx: TodayContext): number {
  const base = ctx.tempC != null ? tempHeft(Math.round(ctx.tempC)) : SEASON_HEFT[ctx.season];
  const late = ctx.daypart === 'day' ? 0 : 1;
  const nudge = ctx.nudge === 'lighter' ? -2 : ctx.nudge === 'bolder' ? 2 : 0;
  return clamp(clamp(base + late) + nudge);
}

/**
 * Day-to-day variety, in score points. Big enough to reorder candidates a point or two apart
 * (so the same top picks don't repeat all week); smaller than a season or rotation swing.
 */
export const JITTER = 1;

/** Deterministic [0, 1) from a string (FNV-1a, then a murmur3 finaliser). */
function jitter(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // murmur3 finaliser: FNV-1a alone leaves the high bits correlated for similar inputs.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

type Scored = Pick & { strengths: number[] };

function score(c: Candidate, ctx: TodayContext, ideal: number): Scored {
  let s = 0;
  const reasons: [ReasonCode, number][] = [];

  if (c.seasons.length) {
    if (c.seasons.includes(ctx.season)) {
      s += 3;
      reasons.push([{ code: 'season' }, 2]);
    } else s -= 2;
  }
  if (c.times.length) {
    if (c.times.includes(ctx.daypart)) {
      s += 2;
      reasons.push([{ code: 'daypart' }, 1.5]);
    } else s -= 1;
  }
  if (ctx.occasion && c.occasions.length) {
    if (c.occasions.includes(ctx.occasion)) {
      s += 3;
      reasons.push([{ code: 'occasion' }, 3]);
    } else s -= 1;
  }

  const h = heft(c);
  s -= Math.abs(h - ideal);
  if (ctx.tempC != null && h === ideal) reasons.push([{ code: 'weather_fit' }, 2.2]);
  if (h >= 1 && ideal >= 1) reasons.push([{ code: 'heavy' }, 1.8]);
  if (h <= -1 && ideal <= -1) reasons.push([{ code: 'fresh' }, 1.8]);

  if (c.lastWorn == null) {
    if (c.sample) {
      s += 3;
      reasons.push([{ code: 'untried_sample' }, 3]);
    } else s += 2;
  } else {
    const days = daysBetween(c.lastWorn, ctx.date);
    if (days <= 0) s -= 8;
    else if (days <= 3) s -= 5;
    else if (days <= 7) s -= 3;
    else if (days <= 14) s -= 1;
    else if (days > 42) {
      s += 2;
      reasons.push([{ code: 'neglected', weeks: Math.floor(days / 7) }, 2.5]);
    }
  }

  s += JITTER * jitter(`${ctx.date}|${c.perfumeId}`);
  reasons.sort((a, b) => b[1] - a[1]);
  return { candidate: c, score: s, reasons: reasons.map(([r]) => r), strengths: reasons.map(([, n]) => n) };
}

/** Picks shown but not worn lose this much the next day and the day after. */
export const SHOWN_PENALTY = [1.5, 0.5] as const;
/** Days of simulated history behind today's picks. */
const HISTORY_DAYS = 6;

function pickOnce(cands: Candidate[], ctx: TodayContext, n: number, shown: Map<string, number>): Pick[] {
  const ideal = idealHeft(ctx);
  const pool = cands.map((c) => {
    const p = score(c, ctx, ideal);
    return { ...p, score: p.score - (shown.get(c.perfumeId) ?? 0) };
  });
  const picks: Pick[] = [];
  while (picks.length < n && pool.length) {
    const families = new Set(picks.map((p) => p.candidate.family).filter(Boolean));
    const adjusted = (p: Scored) => p.score - (p.candidate.family && families.has(p.candidate.family) ? 1 : 0);
    let best = 0;
    for (let i = 1; i < pool.length; i++) {
      const d = adjusted(pool[i]!) - adjusted(pool[best]!);
      if (d > 0 || (d === 0 && pool[i]!.candidate.perfumeId < pool[best]!.candidate.perfumeId)) best = i;
    }
    const [p] = pool.splice(best, 1);
    picks.push({ candidate: p!.candidate, score: adjusted(p!), reasons: p!.reasons });
  }
  return picks;
}

/**
 * Top n candidates for now. A pick sharing a family with an earlier pick loses a point.
 * Picks aren't stored, so the last few days are replayed (same shelf, no new wears) and
 * anything shown yesterday or the day before is pushed down: an unworn favourite rotates out
 * instead of topping the list all week.
 */
export function pickToday(cands: Candidate[], ctx: TodayContext, n = 3): Pick[] {
  let recent: string[][] = [];
  for (let back = HISTORY_DAYS; back >= 1; back--) {
    const day = pickOnce(cands, { ...ctx, date: addDays(ctx.date, -back) }, n, shownPenalties(recent));
    recent = [day.map((p) => p.candidate.perfumeId), ...recent].slice(0, SHOWN_PENALTY.length);
  }
  return pickOnce(cands, ctx, n, shownPenalties(recent));
}

function shownPenalties(recent: string[][]): Map<string, number> {
  const m = new Map<string, number>();
  recent.forEach((ids, i) => ids.forEach((id) => m.set(id, (m.get(id) ?? 0) + SHOWN_PENALTY[i]!)));
  return m;
}
