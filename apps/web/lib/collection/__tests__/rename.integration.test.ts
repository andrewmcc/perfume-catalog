import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';

type Db = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Db = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const tag = crypto.randomUUID().slice(0, 8);
const H = (s: string) => `Zztest ${s} ${tag}`;
let a: Db, b: Db;
let ca = '', cb = '';
const users: string[] = [];

async function member(): Promise<[Db, string]> {
  const login = { email: `rename-${crypto.randomUUID()}@example.com`, password: crypto.randomUUID() };
  const uid = (await admin.auth.admin.createUser({ ...login, email_confirm: true })).data.user!.id;
  users.push(uid);
  const cid = (await admin.from('collections').insert({ name: `zz-test-${crypto.randomUUID()}` }).select('id').single()).data!.id;
  await admin.from('collection_members').insert({ collection_id: cid, user_id: uid, role: 'owner' });
  const c = createClient<Database>(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
  await c.auth.signInWithPassword(login);
  return [c, cid];
}
async function holding(cid: string, perfume: string) {
  const item = (await admin.from('items').insert({ collection_id: cid, perfume_id: perfume }).select('id').single()).data!.id;
  await admin.from('wears').insert({ collection_id: cid, item_id: item, perfume_id: perfume, worn_on: '2026-11-01' } as never);
  return item;
}
const perfume = async (house: string, name: string, cid: string | null, extra: Record<string, unknown> = {}) =>
  (await admin.from('perfumes').insert({ house, name, collection_id: cid, ...extra }).select('id').single()).data!.id;
const rename = (c: Db, p: string, house: string, name: string) => c.rpc('rename_perfume', { p_perfume: p, p_house: house, p_name: name });

beforeAll(async () => {
  [a, ca] = await member();
  [b, cb] = await member();
});
afterAll(async () => {
  for (const c of [ca, cb]) await admin.from('collections').delete().eq('id', c);
  await admin.from('perfumes').delete().like('house', `Zztest %${tag}`);
  for (const u of users) await admin.auth.admin.deleteUser(u);
});

describe('rename_perfume', () => {
  it('a private perfume is renamed in place, marked edited', async () => {
    const p = await perfume(H('Hai'), 'Karate', ca);
    await holding(ca, p);
    const { data, error } = await rename(a, p, H('Hai Karate'), 'Original');
    expect(error).toBeNull();
    expect(data).toBe(p);
    const row = (await admin.from('perfumes').select('house, name, sources').eq('id', p).single()).data!;
    expect(row).toMatchObject({ house: H('Hai Karate'), name: 'Original', sources: { house: 'edited', name: 'edited' } });
  });
  it('a shared perfume is left alone: the collection gets its own copy, with its items and wears moved', async () => {
    const shared = await perfume(H('Chanel'), 'Gris Charnel', null, { notes_top: ['fig'] });
    const item = await holding(ca, shared);
    const other = await holding(cb, shared);
    const { data: copy, error } = await rename(a, shared, H('BDK'), 'Gris Charnel');
    expect(error).toBeNull();
    expect(copy).not.toBe(shared);
    expect((await admin.from('perfumes').select('house, collection_id, notes_top').eq('id', copy as unknown as string).single()).data).toEqual({ house: H('BDK'), collection_id: ca, notes_top: ['fig'] });
    expect((await admin.from('perfumes').select('house').eq('id', shared).single()).data!.house).toBe(H('Chanel'));
    expect((await admin.from('items').select('perfume_id').eq('id', item).single()).data!.perfume_id).toBe(copy);
    expect((await admin.from('wears').select('perfume_id').eq('item_id', item).single()).data!.perfume_id).toBe(copy);
    // Another collection's item of the shared perfume is untouched.
    expect((await admin.from('items').select('perfume_id').eq('id', other).single()).data!.perfume_id).toBe(shared);
  });
  it('renaming to a perfume the collection already has merges into it and removes the empty duplicate', async () => {
    const keep = await perfume(H('EPC'), 'Cardamom Moss', ca);
    const dupe = await perfume(H('E P C'), 'Cardamom Moss 2', ca);
    await holding(ca, keep);
    const moved = await holding(ca, dupe);
    const { data, error } = await rename(a, dupe, H('EPC'), 'cardamom moss');
    expect(error).toBeNull();
    expect(data).toBe(keep);
    expect((await admin.from('items').select('perfume_id').eq('id', moved).single()).data!.perfume_id).toBe(keep);
    expect((await admin.from('perfumes').select('id').eq('id', dupe)).data).toEqual([]);
  });
  it('refuses a perfume the caller has no item of, and blank names', async () => {
    const p = await perfume(H('Private'), 'Theirs', cb);
    await holding(cb, p);
    expect((await rename(a, p, 'X', 'Y')).error?.message).toContain('not found');
    const mine = await perfume(H('Mine'), 'Mine', ca);
    await holding(ca, mine);
    expect((await rename(a, mine, '  ', 'Y')).error?.message).toContain('house and name required');
  });
});
