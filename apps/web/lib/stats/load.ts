import 'server-only';
import { collectionStats, londonNow, type CollectionStats, type StatItem } from '@perfume/core';
import type { createServerClient } from '@perfume/supabase';
import { latestOverrides } from '@/lib/collection/overrides';

type Client = ReturnType<typeof createServerClient>;

/** Stats for the member's collection; family and seasons honour the collection's edits. */
export async function loadStats(supabase: Client, now = new Date()): Promise<CollectionStats> {
  const [{ data: items, error }, { data: wears, error: wErr }, { count, error: sErr }] = await Promise.all([
    supabase.from('items').select('perfume_id, format, status, size_ml, purchase_price, overrides, updated_at, perfumes(house, name, family, seasons, typical_price_per_ml)'),
    supabase.from('wears').select('id, perfume_id, worn_on, rating'),
    supabase.from('sets').select('id', { count: 'exact', head: true }),
  ]);
  if (error) throw error;
  if (wErr) throw wErr;
  if (sErr) throw sErr;

  const edits = new Map<string, Record<string, unknown>>();
  for (const id of new Set(items.map((i) => i.perfume_id))) edits.set(id, latestOverrides(items.filter((i) => i.perfume_id === id)));

  const stat: StatItem[] = items.map((i) => {
    const o = edits.get(i.perfume_id) ?? {};
    const p = i.perfumes;
    return {
      perfumeId: i.perfume_id,
      house: p?.house ?? '',
      name: p?.name ?? '',
      family: 'family' in o ? ((o.family as string | null) ?? null) : (p?.family ?? null),
      seasons: 'seasons' in o ? ((o.seasons as string[] | null) ?? []) : (p?.seasons ?? []),
      format: i.format,
      status: i.status,
      sizeMl: i.size_ml,
      price: i.purchase_price,
      typicalPerMl: p?.typical_price_per_ml ?? null,
    };
  });
  return collectionStats(
    stat,
    wears.map((w) => ({ id: w.id, perfumeId: w.perfume_id, wornOn: w.worn_on, rating: w.rating })),
    count ?? 0,
    londonNow(now).date,
  );
}
