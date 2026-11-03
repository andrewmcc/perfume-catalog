import 'server-only';
import type { Daypart } from '@perfume/core';
import type { createServerClient } from '@perfume/supabase';
import { latestOverrides } from '@/lib/collection/overrides';

type Client = ReturnType<typeof createServerClient>;

export type DiaryWear = {
  id: string;
  perfumeId: string;
  itemId: string | null;
  wornOn: string;
  timeOfDay: Daypart | null;
  rating: number | null;
  notes: string | null;
  house: string;
  name: string;
  family: string | null;
};

export type Wearable = { itemId: string; perfumeId: string; house: string; name: string; format: string; setName: string | null };

/** Effective family per perfume: the collection's latest override, else the perfume's own. */
async function familiesOf(supabase: Client, perfumeIds: string[], own: Map<string, string | null>): Promise<Map<string, string | null>> {
  if (!perfumeIds.length) return new Map();
  const { data, error } = await supabase.from('items').select('perfume_id, overrides, updated_at').in('perfume_id', perfumeIds);
  if (error) throw error;
  return new Map(
    perfumeIds.map((id) => {
      const o = latestOverrides(data.filter((i) => i.perfume_id === id));
      return [id, 'family' in o ? ((o.family as string | null) ?? null) : (own.get(id) ?? null)];
    }),
  );
}

/** Wears dated within a month (YYYY-MM), oldest first, with each perfume's effective family. */
export async function loadMonth(supabase: Client, ym: string): Promise<DiaryWear[]> {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const { data, error } = await supabase
    .from('wears')
    .select('id, perfume_id, item_id, worn_on, time_of_day, rating, notes, created_at, perfumes(house, name, family)')
    .gte('worn_on', `${ym}-01`)
    .lte('worn_on', `${ym}-${String(last).padStart(2, '0')}`)
    .order('worn_on')
    .order('created_at');
  if (error) throw error;
  const ids = [...new Set(data.map((w) => w.perfume_id))];
  const families = await familiesOf(supabase, ids, new Map(data.map((w) => [w.perfume_id, w.perfumes?.family ?? null])));
  return data.map((w) => ({
    id: w.id,
    perfumeId: w.perfume_id,
    itemId: w.item_id,
    wornOn: w.worn_on,
    timeOfDay: w.time_of_day as Daypart | null,
    rating: w.rating,
    notes: w.notes,
    house: w.perfumes?.house ?? '',
    name: w.perfumes?.name ?? '',
    family: families.get(w.perfume_id) ?? null,
  }));
}

/** Owned items that can be worn, by house then name. */
export async function loadWearables(supabase: Client): Promise<Wearable[]> {
  const { data, error } = await supabase.from('items').select('id, perfume_id, format, perfumes(house, name), sets(name)').eq('status', 'owned');
  if (error) throw error;
  return data
    .map((i) => ({ itemId: i.id, perfumeId: i.perfume_id, house: i.perfumes?.house ?? '', name: i.perfumes?.name ?? '', format: i.format, setName: i.sets?.name ?? null }))
    .sort((a, b) => a.house.localeCompare(b.house) || a.name.localeCompare(b.name));
}

/** Wears per London date in a year. */
export async function loadYearCounts(supabase: Client, year: number): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('wears').select('worn_on').gte('worn_on', `${year}-01-01`).lte('worn_on', `${year}-12-31`);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const w of data) counts.set(w.worn_on, (counts.get(w.worn_on) ?? 0) + 1);
  return counts;
}
