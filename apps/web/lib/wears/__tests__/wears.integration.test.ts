import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';
import { asWearInsert } from '../insert';

// Hosted DB. Members A (collection CA) and B (collection CB), each with one item of a shared perfume.
type Db = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Db = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);

const tag = crypto.randomUUID().slice(0, 8);
const house = `Zztest House ${tag}`;
const users: string[] = [];
let a: Db;
let b: Db;
let ca = '';
let cb = '';
let perfumeA = '';
let perfumeB = '';
let itemA = '';
let itemB = '';

async function member(): Promise<{ client: Db; cid: string }> {
  const email = `wears-test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const { data: c, error: cErr } = await admin.from('collections').insert({ name: `zz-test-${crypto.randomUUID()}` }).select('id').single();
  if (cErr) throw cErr;
  const { error: mErr } = await admin.from('collection_members').insert({ collection_id: c.id, user_id: data.user.id, role: 'owner' });
  if (mErr) throw mErr;
  const client = createClient<Database>(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
  const { error: sErr } = await client.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  return { client, cid: c.id };
}

async function perfume(name: string): Promise<string> {
  const { data, error } = await admin.from('perfumes').insert({ house, name, concentration: 'edp' }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function itemOf(cid: string, perfumeId: string): Promise<string> {
  const { data, error } = await admin.from('items').insert({ collection_id: cid, perfume_id: perfumeId }).select('id').single();
  if (error) throw error;
  return data.id;
}

const wears = (c: Db) => c.from('wears');
const settings = (c: Db) => c.from('collection_settings');

beforeAll(async () => {
  ({ client: a, cid: ca } = await member());
  ({ client: b, cid: cb } = await member());
  perfumeA = await perfume('Wear One');
  perfumeB = await perfume('Wear Two');
  itemA = await itemOf(ca, perfumeA);
  itemB = await itemOf(cb, perfumeB);
});

afterAll(async () => {
  for (const c of [ca, cb].filter(Boolean)) await admin.from('collections').delete().eq('id', c);
  await admin.from('perfumes').delete().like('house', 'Zztest House%');
  for (const u of users) await admin.auth.admin.deleteUser(u);
});

describe('wears', () => {
  it('member logs a wear; perfume_id comes from the item', async () => {
    const { data, error } = await wears(a)
      .insert({ collection_id: ca, item_id: itemA, perfume_id: perfumeB, worn_on: '2026-11-02', rating: 4, notes: 'Lovely' })
      .select('*')
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ perfume_id: perfumeA, item_id: itemA, collection_id: ca, rating: 4 });
  });

  it("a wear with another collection's item is refused", async () => {
    const { error } = await wears(a).insert(asWearInsert({ collection_id: ca, item_id: itemB, worn_on: '2026-11-02' }));
    expect(error).not.toBeNull();
  });

  it('a wear without an item is refused', async () => {
    const { error } = await wears(a).insert({ collection_id: ca, perfume_id: perfumeA, worn_on: '2026-11-02' } as never);
    expect(error).not.toBeNull();
  });

  it('a non-member cannot read or update the wear', async () => {
    const { data: w } = await wears(a).insert(asWearInsert({ collection_id: ca, item_id: itemA, worn_on: '2026-11-01' })).select('id').single();
    const { data: seen } = await wears(b).select('id').eq('id', w!.id);
    expect(seen).toEqual([]);
    const { data: updated } = await wears(b).update({ rating: 1 }).eq('id', w!.id).select('id');
    expect(updated ?? []).toEqual([]);
  });

  it('an update cannot repoint the perfume', async () => {
    const { data: w } = await wears(a).insert(asWearInsert({ collection_id: ca, item_id: itemA, worn_on: '2026-10-30' })).select('id').single();
    await wears(a).update({ perfume_id: perfumeB }).eq('id', w!.id);
    const { data } = await admin.from('wears').select('perfume_id').eq('id', w!.id).single();
    expect(data).toMatchObject({ perfume_id: perfumeA });
  });

  it('deleting the item keeps the wear and its perfume', async () => {
    const extra = await itemOf(ca, perfumeA);
    const { data: w } = await wears(a).insert(asWearInsert({ collection_id: ca, item_id: extra, worn_on: '2026-10-31' })).select('id').single();
    const { error } = await a.from('items').delete().eq('id', extra);
    expect(error).toBeNull();
    const { data } = await wears(a).select('*').eq('id', w!.id).single();
    expect(data).toMatchObject({ item_id: null, perfume_id: perfumeA });
  });

  it('created_by is always the signed-in member and cannot be changed', async () => {
    const other = users[1]!;
    const { data: w, error } = await wears(a).insert(asWearInsert({ collection_id: ca, item_id: itemA, worn_on: '2026-10-29', created_by: other } as never)).select('id, created_by').single();
    expect(error).toBeNull();
    expect(w!.created_by).toBe(users[0]);
    await wears(a).update({ created_by: other }).eq('id', w!.id);
    const { data } = await admin.from('wears').select('created_by').eq('id', w!.id).single();
    expect(data!.created_by).toBe(users[0]);
  });

  it('rating 0 and 6 are refused; null is fine', async () => {
    for (const rating of [0, 6]) {
      const { error } = await wears(a).insert(asWearInsert({ collection_id: ca, item_id: itemA, worn_on: '2026-11-02', rating }));
      expect(error).not.toBeNull();
    }
    const { error } = await wears(a).insert(asWearInsert({ collection_id: ca, item_id: itemA, worn_on: '2026-11-02', rating: null }));
    expect(error).toBeNull();
  });
});

describe('deleting the member', () => {
  it('keeps their wears with created_by null', async () => {
    const m = await member();
    const p = await itemOf(m.cid, perfumeA);
    const { data: w, error } = await wears(m.client).insert(asWearInsert({ collection_id: m.cid, item_id: p, worn_on: '2026-10-28' })).select('id').single();
    expect(error).toBeNull();
    const uid = users.pop()!;
    const { error: dErr } = await admin.auth.admin.deleteUser(uid);
    expect(dErr).toBeNull();
    const { data } = await admin.from('wears').select('created_by').eq('id', w!.id).single();
    expect(data!.created_by).toBeNull();
    await admin.from('collections').delete().eq('id', m.cid);
  });
});

describe('collection_settings', () => {
  it('a member upserts their location; another member cannot read it', async () => {
    const { error } = await settings(a).upsert({ collection_id: ca, lat: 51.5, lon: -0.14, place: 'SW1A' });
    expect(error).toBeNull();
    const { data: mine } = await settings(a).select('*').eq('collection_id', ca).single();
    expect(mine).toMatchObject({ lat: 51.5, lon: -0.14, place: 'SW1A' });
    const { data: theirs } = await settings(b).select('*').eq('collection_id', ca);
    expect(theirs).toEqual([]);
    const { error: bErr } = await settings(b).upsert({ collection_id: ca, lat: 1, lon: 1 });
    expect(bErr).not.toBeNull();
  });
});
