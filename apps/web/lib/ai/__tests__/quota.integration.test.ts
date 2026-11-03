import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';
import { claimAi } from '../quota';

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const db: SupabaseClient<Database> = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
let cid = '';

beforeAll(async () => {
  cid = (await db.from('collections').insert({ name: `zz-test-${crypto.randomUUID()}` }).select('id').single()).data!.id;
});
afterAll(async () => {
  await db.from('collections').delete().eq('id', cid);
});

describe('claimAi', () => {
  it('allows the cap per kind per collection per day, even in parallel', async () => {
    const now = new Date('2026-11-03T10:00:00Z');
    const got = await Promise.all([1, 2, 3].map(() => claimAi(db, cid, 'identify', now, 2)));
    expect(got.filter(Boolean)).toHaveLength(2);
    expect(await claimAi(db, cid, 'gap_suggest', now, 2)).toBe(true);
    expect(await claimAi(db, cid, 'identify', new Date('2026-11-04T09:59:00Z'), 2)).toBe(false);
    expect(await claimAi(db, cid, 'identify', new Date('2026-11-04T10:01:00Z'), 2)).toBe(true);
  });
  it('rejects unknown kinds', async () => {
    await expect(claimAi(db, cid, 'bogus' as never)).rejects.toBeTruthy();
  });
  it('members cannot call it', async () => {
    const anon = createClient<Database>(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
    const { error } = await anon.rpc('claim_ai' as never, { p_collection: cid, p_kind: 'identify', p_cap: 99 } as never);
    expect(error).not.toBeNull();
  });
  it('wish_reason is at most 80 characters', async () => {
    const p = (await db.from('perfumes').insert({ house: `Zztest Wish ${crypto.randomUUID().slice(0, 8)}`, name: 'W', collection_id: cid }).select('id').single()).data!.id;
    const long = await db.from('items').insert({ collection_id: cid, perfume_id: p, status: 'wishlist', wish_reason: 'x'.repeat(81) });
    expect(long.error).not.toBeNull();
    const ok = await db.from('items').insert({ collection_id: cid, perfume_id: p, status: 'wishlist', wish_reason: 'Fills your hot-days gap' });
    expect(ok.error).toBeNull();
  });
});
