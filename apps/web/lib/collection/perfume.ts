import 'server-only';
import { effectivePerfume, pyramidWeight, type FactField, type PerfumeFacts, type Source, type Weight } from '@perfume/core';
import type { createServerClient } from '@perfume/supabase';
import { latestOverrides, signPaths } from './load';

type Client = ReturnType<typeof createServerClient>;

export type ItemDetail = {
  id: string;
  format: string;
  size_ml: number | null;
  status: string;
  purchase_price: number | null;
  purchased_on: string | null;
  purchase_source: string | null;
  batch_code: string | null;
  notes: string | null;
  overrides: Record<string, unknown>;
  setId: string | null;
  setName: string | null;
  photo: string | null;
};

export type PerfumeDetail = {
  id: string;
  house: string;
  name: string;
  facts: PerfumeFacts;
  values: Record<FactField, unknown>;
  source: Record<FactField, Source | null>;
  weight: Weight | null;
  hero: string | null;
  items: ItemDetail[];
};

/** A perfume with this collection's items of it; null if not visible or the collection has no item of it. */
export async function loadPerfume(supabase: Client, perfumeId: string): Promise<PerfumeDetail | null> {
  const { data: p } = await supabase.from('perfumes').select('*').eq('id', perfumeId).maybeSingle();
  if (!p) return null;
  const { data: items, error } = await supabase
    .from('items')
    .select('*, sets(id, name), item_photos(storage_path, thumb_path, position)')
    .eq('perfume_id', perfumeId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  if (!items.length) return null;

  const firstPhoto = (i: (typeof items)[number]) => [...i.item_photos].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null;
  const url = await signPaths(supabase, items.map(firstPhoto));
  const facts = { ...p, sources: (p.sources ?? {}) as Record<string, string> } as PerfumeFacts;
  const { values, source } = effectivePerfume(facts, latestOverrides(items));
  const owned = items.find((i) => i.status === 'owned') ?? items[0]!;
  const heroPath = firstPhoto(owned) ?? items.map(firstPhoto).find(Boolean) ?? null;

  return {
    id: p.id,
    house: p.house,
    name: p.name,
    facts,
    values,
    source,
    weight: pyramidWeight({ notes_top: values.notes_top as string[], notes_heart: values.notes_heart as string[], notes_base: values.notes_base as string[] }),
    hero: heroPath ? (url.get(heroPath) ?? null) : null,
    items: items.map((i) => {
      const path = firstPhoto(i);
      return {
        id: i.id,
        format: i.format,
        size_ml: i.size_ml,
        status: i.status,
        purchase_price: i.purchase_price,
        purchased_on: i.purchased_on,
        purchase_source: i.purchase_source,
        batch_code: i.batch_code,
        notes: i.notes,
        overrides: (i.overrides ?? {}) as Record<string, unknown>,
        setId: i.set_id,
        setName: i.sets?.name ?? null,
        photo: path ? (url.get(path) ?? null) : null,
      };
    }),
  };
}

export type SetDetail = { id: string; house: string | null; name: string | null; items: { id: string; perfumeId: string; house: string; name: string; status: string }[] };

export async function loadSet(supabase: Client, setId: string): Promise<SetDetail | null> {
  const { data: s } = await supabase.from('sets').select('id, house, name').eq('id', setId).maybeSingle();
  if (!s) return null;
  const { data: items, error } = await supabase.from('items').select('id, perfume_id, status, perfumes(house, name)').eq('set_id', setId).order('created_at');
  if (error) throw error;
  return {
    ...s,
    items: items.map((i) => ({ id: i.id, perfumeId: i.perfume_id, house: i.perfumes?.house ?? '', name: i.perfumes?.name ?? '', status: i.status })),
  };
}
