import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';
import { addFromText, parseFromText } from '../add-from-text';

type Db = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Db = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const house = `Zztest Text ${crypto.randomUUID().slice(0, 8)}`;
let user: Db;
// The test's supabase-js is another copy of the same version than @perfume/supabase's; same shape.
const as = (c: Db) => c as unknown as Parameters<typeof addFromText>[0];
let cid = '';
let uid = '';

beforeAll(async () => {
  const email = `text-test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  uid = data.user.id;
  cid = (await admin.from('collections').insert({ name: `zz-test-${crypto.randomUUID()}` }).select('id').single()).data!.id;
  await admin.from('collection_members').insert({ collection_id: cid, user_id: uid, role: 'owner' });
  user = createClient<Database>(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
  await user.auth.signInWithPassword({ email, password });
});
afterAll(async () => {
  await admin.from('collections').delete().eq('id', cid);
  await admin.from('perfumes').delete().eq('house', house);
  await admin.auth.admin.deleteUser(uid);
});

describe('addFromText', () => {
  it('links to an existing shared perfume instead of creating one', async () => {
    const shared = (await admin.from('perfumes').insert({ house, name: 'Shared One', concentration: 'edp' }).select('id').single()).data!.id;
    const got = await addFromText(as(user), cid, parseFromText({ house, name: 'shared one', concentration: 'edp', status: 'wishlist' })!);
    expect(got.perfumeId).toBe(shared);
    expect(got.created).toBe(false);
    const it = (await admin.from('items').select('*').eq('id', got.itemId).single()).data!;
    expect(it).toMatchObject({ collection_id: cid, perfume_id: shared, status: 'wishlist', format: 'full' });
  });
  it('creates a private perfume labelled from text, and reuses it the second time', async () => {
    const first = await addFromText(as(user), cid, parseFromText({ house, name: 'Brand New', status: 'wishlist', reason: '  Fills your hot-days gap ' })!);
    expect(first.created).toBe(true);
    const p = (await admin.from('perfumes').select('*').eq('id', first.perfumeId).single()).data!;
    expect(p.collection_id).toBe(cid);
    expect(p.sources).toMatchObject({ house: 'text', name: 'text' });
    expect((await admin.from('items').select('wish_reason').eq('id', first.itemId).single()).data!.wish_reason).toBe('Fills your hot-days gap');
    const second = await addFromText(as(user), cid, parseFromText({ house, name: 'Brand New', status: 'owned', reason: 'ignored' })!);
    expect(second.perfumeId).toBe(first.perfumeId);
    expect((await admin.from('items').select('wish_reason, status').eq('id', second.itemId).single()).data).toEqual({ wish_reason: null, status: 'owned' });
  });
});

describe('parseFromText', () => {
  it('validates the body', () => {
    expect(parseFromText({ house: 'A', name: 'B', status: 'gone' })).toBeNull();
    expect(parseFromText({ house: '', name: 'B', status: 'owned' })).toBeNull();
    expect(parseFromText({ house: 'A', name: 'B', status: 'owned', concentration: 'bogus' })).toBeNull();
    expect(parseFromText({ house: 'A'.repeat(81), name: 'B', status: 'owned' })).toBeNull();
    expect(parseFromText({ house: ' A ', name: 'B', status: 'wishlist', reason: 'x'.repeat(200) })).toEqual({ house: 'A', name: 'B', concentration: null, flanker: null, status: 'wishlist', reason: 'x'.repeat(80) });
  });
});
