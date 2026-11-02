import 'server-only';
import { NO_WEARS, effectivePerfume, pyramidWeight, wearSummary, type CollectionRow, type PerfumeFacts } from '@perfume/core';
import type { createServerClient } from '@perfume/supabase';
import { latestOverrides } from './overrides';

type Client = ReturnType<typeof createServerClient>;
export type SetRow = { id: string; house: string | null; name: string | null; count: number; thumb: string | null };

export const PHOTO_TTL_S = 3600;

/** Signed URLs for many storage paths at once (nulls skipped). */
export async function signPaths(supabase: Client, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.storage.from('photos').createSignedUrls(unique, PHOTO_TTL_S);
  if (error) throw error;
  return new Map(data.flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
}

type Photo = { storage_path: string; thumb_path: string | null; position: number };
/** The list image for an item: its first photo's thumbnail, else the photo itself. */
export const listPath = (photos: Photo[]): string | null => {
  const first = [...photos].sort((a, b) => a.position - b.position)[0];
  return first ? (first.thumb_path ?? first.storage_path) : null;
};

export { latestOverrides } from './overrides';

export async function loadCollection(supabase: Client): Promise<{ rows: CollectionRow[]; sets: SetRow[] }> {
  const [{ data: items, error }, { data: sets, error: sErr }, { data: wears, error: wErr }] = await Promise.all([
    supabase
      .from('items')
      .select('id, perfume_id, format, size_ml, status, set_id, overrides, updated_at, created_at, perfumes(*), sets(id, name), item_photos(storage_path, thumb_path, position)')
      .order('created_at', { ascending: true }),
    supabase.from('sets').select('id, house, name, created_at').order('created_at', { ascending: true }),
    supabase.from('wears').select('id, perfume_id, worn_on, rating'),
  ]);
  if (error) throw error;
  if (sErr) throw sErr;
  if (wErr) throw wErr;
  const worn = wearSummary(wears.map((w) => ({ id: w.id, perfumeId: w.perfume_id, wornOn: w.worn_on, rating: w.rating })));

  const url = await signPaths(supabase, items.map((i) => listPath(i.item_photos)));

  const byPerfume = new Map<string, typeof items>();
  for (const i of items) byPerfume.set(i.perfume_id, [...(byPerfume.get(i.perfume_id) ?? []), i]);

  const rows: CollectionRow[] = [];
  for (const [perfumeId, group] of byPerfume) {
    const p = group[0]!.perfumes!;
    const { values: v } = effectivePerfume({ ...p, sources: (p.sources ?? {}) as Record<string, string> } as PerfumeFacts, latestOverrides(group));
    const notes = { top: v.notes_top as string[], heart: v.notes_heart as string[], base: v.notes_base as string[] };
    const thumbPath = group.map((i) => listPath(i.item_photos)).find(Boolean);
    rows.push({
      perfumeId,
      house: p.house,
      name: p.name,
      concentration: v.concentration as string | null,
      family: v.family as string | null,
      seasons: v.seasons as string[],
      times: v.times_of_day as string[],
      occasions: v.occasions as string[],
      accords: v.accords as string[],
      notes,
      weight: pyramidWeight({ notes_top: notes.top, notes_heart: notes.heart, notes_base: notes.base }),
      thumb: thumbPath ? (url.get(thumbPath) ?? null) : null,
      items: group.map((i) => ({ id: i.id, format: i.format, size_ml: i.size_ml, status: i.status, setId: i.set_id, setName: i.sets?.name ?? null })),
      wear: (({ count, avgRating, lastWorn }) => ({ count, avgRating, lastWorn }))(worn.get(perfumeId) ?? NO_WEARS),
    });
  }
  rows.sort((a, b) => a.house.localeCompare(b.house) || a.name.localeCompare(b.name));

  const setRows: SetRow[] = sets.map((s) => {
    const members = items.filter((i) => i.set_id === s.id);
    const path = members.map((i) => listPath(i.item_photos)).find(Boolean);
    return { id: s.id, house: s.house, name: s.name, count: members.length, thumb: path ? (url.get(path) ?? null) : null };
  });
  return { rows, sets: setRows };
}
