import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';
import { claimLookup } from '../lookup';

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const db: SupabaseClient<Database> = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const house = `Zztest Lookup ${crypto.randomUUID().slice(0, 8)}`;
let cid = '';
const perfume = async (name: string) => (await db.from('perfumes').insert({ house, name }).select('id').single()).data!.id;

beforeAll(async () => {
  cid = (await db.from('collections').insert({ name: `zz-test-${crypto.randomUUID()}` }).select('id').single()).data!.id;
});
afterAll(async () => {
  await db.from('collections').delete().eq('id', cid);
  await db.from('perfumes').delete().eq('house', house);
});

describe('claimLookup', () => {
  it('one claim per perfume per day, even when two arrive together', async () => {
    const p = await perfume('Once');
    const now = new Date('2026-11-03T10:00:00Z');
    const [a, b] = await Promise.all([claimLookup(db, cid, p, now), claimLookup(db, cid, p, now)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await claimLookup(db, cid, p, new Date('2026-11-04T09:59:00Z'))).toBe(false);
    expect(await claimLookup(db, cid, p, new Date('2026-11-04T10:01:00Z'))).toBe(true);
  });
  it('a collection gets at most N lookups a day across new perfumes', async () => {
    const now = new Date('2026-12-01T10:00:00Z');
    const ps = await Promise.all(['a', 'b', 'c'].map(perfume));
    expect(await claimLookup(db, cid, ps[0]!, now, 2)).toBe(true);
    expect(await claimLookup(db, cid, ps[1]!, now, 2)).toBe(true);
    expect(await claimLookup(db, cid, ps[2]!, now, 2)).toBe(false);
  });
  it('members cannot call the claim function', async () => {
    const anon = createClient<Database>(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
    const { error } = await anon.rpc('claim_lookup' as never, { p_collection: cid, p_perfume: cid } as never);
    expect(error).not.toBeNull();
  });
});
