import 'server-only';
import { OCCASIONS, headline, londonNow, pickToday, type Candidate, type CollectionRow, type LondonNow, type Nudge, type Pick, type TodayContext } from '@perfume/core';
import type { createServerClient } from '@perfume/supabase';
import { loadCollection } from '@/lib/collection/load';
import { wearItemFor } from '@/lib/collection/wear-helpers';
import { getWeather } from '@/lib/weather/cached';
import type { Weather } from '@/lib/weather/current';

type Client = ReturnType<typeof createServerClient>;
type Params = Record<string, string | string[] | undefined>;

export type TodayPick = Pick & { thumb: string | null };
export type Today = {
  now: LondonNow;
  ctx: TodayContext;
  headline: { title: string; sub: string };
  picks: TodayPick[];
  weather: Weather | null;
  place: string | null;
  hasLocation: boolean;
  ownedCount: number;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
export const parseNudge = (v: string | undefined): Nudge | null => (v === 'lighter' || v === 'bolder' ? v : null);
export const parseOccasion = (v: string | undefined): string | null => (v && (OCCASIONS as readonly string[]).includes(v) ? v : null);

/** One candidate per perfume with something owned; samples-only perfumes are sample candidates. */
export function candidatesOf(rows: CollectionRow[]): Candidate[] {
  return rows.flatMap((r) => {
    const owned = r.items.filter((i) => i.status === 'owned');
    const itemId = wearItemFor(owned);
    if (!itemId) return [];
    const item = owned.find((i) => i.id === itemId)!;
    return [
      {
        perfumeId: r.perfumeId,
        itemId,
        house: r.house,
        name: r.name,
        family: r.family,
        seasons: r.seasons,
        times: r.times,
        occasions: r.occasions,
        weight: r.weight,
        sillage: r.sillage,
        sample: owned.every((i) => i.format === 'sample'),
        lastWorn: r.wear.lastWorn,
        sizeMl: item.size_ml,
        setName: item.setName,
      },
    ];
  });
}

export async function loadToday(supabase: Client, sp: Params, now: Date): Promise<Today> {
  const london = londonNow(now);
  const [{ rows }, { data: settings, error }] = await Promise.all([
    loadCollection(supabase),
    supabase.from('collection_settings').select('lat, lon, place').maybeSingle(),
  ]);
  if (error) throw error;
  const hasLocation = settings?.lat != null && settings?.lon != null;
  const weather = hasLocation ? await getWeather(Number(settings.lat), Number(settings.lon)) : null;
  const ctx: TodayContext = {
    date: london.date,
    daypart: london.daypart,
    season: london.season,
    tempC: weather?.tempC ?? null,
    nudge: parseNudge(one(sp.n)),
    occasion: parseOccasion(one(sp.o)),
  };
  const cands = candidatesOf(rows);
  const thumbs = new Map(rows.map((r) => [r.perfumeId, r.thumb]));
  return {
    now: london,
    ctx,
    headline: headline(ctx),
    picks: pickToday(cands, ctx).map((p) => ({ ...p, thumb: thumbs.get(p.candidate.perfumeId) ?? null })),
    weather,
    place: settings?.place ?? null,
    hasLocation,
    ownedCount: cands.length,
  };
}
