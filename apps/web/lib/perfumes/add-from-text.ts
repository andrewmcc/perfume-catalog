import 'server-only';
import { z } from 'zod';
import { Concentration } from '@perfume/core';
import type { createServerClient } from '@perfume/supabase';

// Structural, so a server client and a plain supabase-js client both fit.
type Client = Pick<ReturnType<typeof createServerClient>, 'rpc' | 'from'>;

const text = (max: number) => z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(max));

const FromTextBody = z.object({
  house: text(80),
  name: text(80),
  concentration: Concentration.nullish(),
  flanker: z.string().nullish(),
  status: z.enum(['owned', 'wishlist']),
  reason: z.string().nullish(),
});

export type FromText = { house: string; name: string; concentration: string | null; flanker: string | null; status: 'owned' | 'wishlist'; reason: string | null };

/** The validated add request, or null. The reason is kept for wishlist items only, cut to 80 characters. */
export function parseFromText(body: unknown): FromText | null {
  const r = FromTextBody.safeParse(body);
  if (!r.success) return null;
  const { house, name, concentration, flanker, status, reason } = r.data;
  const f = flanker?.trim();
  if (f && f.length > 80) return null;
  return {
    house,
    name,
    concentration: concentration || null,
    flanker: f || null,
    status,
    reason: status === 'wishlist' ? reason?.trim().slice(0, 80) || null : null,
  };
}

/**
 * Adds an item from typed text, with the member's own client (RLS). Links to a perfume the
 * collection can already see; otherwise creates one private to the collection, marked from text.
 */
export async function addFromText(db: Client, collectionId: string, input: FromText): Promise<{ perfumeId: string; itemId: string; created: boolean }> {
  const find = async () => {
    const { data, error } = await db.rpc('find_perfume', {
      p_collection: collectionId,
      p_house: input.house,
      p_name: input.name,
      p_conc: input.concentration ?? '',
      p_flanker: input.flanker ?? '',
    });
    if (error) throw error;
    return (data as string | null) ?? null;
  };

  let perfumeId = await find();
  let created = false;
  if (!perfumeId) {
    const sources: Record<string, string> = { house: 'text', name: 'text' };
    if (input.concentration) sources.concentration = 'text';
    if (input.flanker) sources.flanker = 'text';
    const { data, error } = await db
      .from('perfumes')
      .insert({ collection_id: collectionId, house: input.house, name: input.name, concentration: input.concentration, flanker: input.flanker, sources })
      .select('id')
      .single();
    if (error && error.code !== '23505') throw error;
    perfumeId = data?.id ?? (await find());
    created = !!data;
    if (!perfumeId) throw new Error('perfume not created');
  }

  if (!created) {
    // Already in the collection: reuse rather than add a second item. Buying something wished
    // for moves the wishlist item to owned; wishing for something owned keeps the owned item.
    const { data: have, error: hErr } = await db.from('items').select('id, status').eq('collection_id', collectionId).eq('perfume_id', perfumeId);
    if (hErr) throw hErr;
    const same = have.find((i) => i.status === input.status);
    if (same) return { perfumeId, itemId: same.id, created };
    const wished = have.find((i) => i.status === 'wishlist');
    if (input.status === 'owned' && wished) {
      const { error: uErr } = await db.from('items').update({ status: 'owned', wish_reason: null }).eq('id', wished.id);
      if (uErr) throw uErr;
      return { perfumeId, itemId: wished.id, created };
    }
    const owned = have.find((i) => i.status === 'owned');
    if (input.status === 'wishlist' && owned) return { perfumeId, itemId: owned.id, created };
  }

  const { data: item, error } = await db
    .from('items')
    .insert({ collection_id: collectionId, perfume_id: perfumeId, status: input.status, format: 'full', wish_reason: input.reason })
    .select('id')
    .single();
  if (error) throw error;
  return { perfumeId, itemId: item.id, created };
}
