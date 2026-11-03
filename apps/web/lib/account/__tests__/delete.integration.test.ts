import { afterAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';
import { deleteAccount } from '../delete';

type Db = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Db = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const as = (c: Db) => c as unknown as Parameters<typeof deleteAccount>[0];
const users: string[] = [];
const collections: string[] = [];
const sharedHouse = `Zztest Shared ${crypto.randomUUID().slice(0, 8)}`;

const logins = new Map<string, { email: string; password: string }>();
async function user() {
  const login = { email: `del-test-${crypto.randomUUID()}@example.com`, password: crypto.randomUUID() };
  const { data, error } = await admin.auth.admin.createUser({ ...login, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  logins.set(data.user.id, login);
  return data.user.id;
}
async function signedIn(uid: string): Promise<Db> {
  const c = createClient<Database>(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
  const { error } = await c.auth.signInWithPassword(logins.get(uid)!);
  if (error) throw error;
  return c;
}
async function collectionWith(...uids: string[]) {
  const cid = (await admin.from('collections').insert({ name: `zz-test-${crypto.randomUUID()}` }).select('id').single()).data!.id;
  collections.push(cid);
  for (const u of uids) await admin.from('collection_members').insert({ collection_id: cid, user_id: u, role: 'owner' });
  const priv = (await admin.from('perfumes').insert({ house: 'Zztest Private', name: cid, collection_id: cid }).select('id').single()).data!.id;
  const shared = (await admin.from('perfumes').insert({ house: sharedHouse, name: cid }).select('id').single()).data!.id;
  const item = (await admin.from('items').insert({ collection_id: cid, perfume_id: shared }).select('id').single()).data!.id;
  await admin.from('wears').insert({ collection_id: cid, item_id: item, perfume_id: shared, worn_on: '2026-11-01' });
  const path = `${cid}/${crypto.randomUUID()}/photo-1.jpg`;
  const { error } = await admin.storage.from('photos').upload(path, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }));
  if (error) throw error;
  return { cid, priv, shared, path };
}
const exists = async (table: 'collections' | 'perfumes' | 'items' | 'wears', col: string, v: string) => ((await admin.from(table).select('id').eq(col, v)).data ?? []).length > 0;
const fileExists = async (path: string) => {
  const [dir, file] = [path.slice(0, path.lastIndexOf('/')), path.slice(path.lastIndexOf('/') + 1)];
  return ((await admin.storage.from('photos').list(dir)).data ?? []).some((f) => f.name === file);
};

afterAll(async () => {
  for (const c of collections) await admin.from('collections').delete().eq('id', c);
  await admin.from('perfumes').delete().eq('house', sharedHouse);
  for (const u of users) await admin.auth.admin.deleteUser(u).catch(() => {});
});

describe('deleteAccount', () => {
  it('the last member takes the collection, its data, private perfumes and photos with them; shared perfumes stay', async () => {
    const u = await user();
    const other = await collectionWith(await user());
    const c = await collectionWith(u);
    expect(await deleteAccount(as(admin), u)).toEqual({ deletedCollections: [c.cid] });
    expect(await exists('collections', 'id', c.cid)).toBe(false);
    expect(await exists('items', 'collection_id', c.cid)).toBe(false);
    expect(await exists('wears', 'collection_id', c.cid)).toBe(false);
    expect(await exists('perfumes', 'id', c.priv)).toBe(false);
    expect(await exists('perfumes', 'id', c.shared)).toBe(true);
    expect(await fileExists(c.path)).toBe(false);
    expect(await fileExists(other.path)).toBe(true);
    expect((await admin.auth.admin.getUserById(u)).data.user).toBeNull();
  });
  it('with another member left, the collection and everything in it stay', async () => {
    const u = await user();
    const v = await user();
    const c = await collectionWith(u, v);
    expect(await deleteAccount(as(admin), u)).toEqual({ deletedCollections: [] });
    expect(await exists('collections', 'id', c.cid)).toBe(true);
    expect(await exists('wears', 'collection_id', c.cid)).toBe(true);
    expect(await fileExists(c.path)).toBe(true);
    expect((await admin.from('collection_members').select('user_id').eq('collection_id', c.cid)).data).toEqual([{ user_id: v }]);
  });
  it('a member who scanned, uploaded and logged wears in a shared collection can still be deleted; their data stays', async () => {
    const u = await user();
    const v = await user();
    const c = await collectionWith(u, v);
    const me = await signedIn(u);
    const scanId = crypto.randomUUID();
    const path = `${c.cid}/${scanId}/photo-1.jpg`;
    const up = await me.storage.from('photos').upload(path, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }));
    expect(up.error).toBeNull();
    expect((await me.from('scans').insert({ id: scanId, collection_id: c.cid, created_by: u, mode: 'bottle', photo_paths: [path] })).error).toBeNull();
    const item = (await admin.from('items').select('id').eq('collection_id', c.cid).single()).data!.id;
    expect((await me.from('wears').insert({ collection_id: c.cid, item_id: item, worn_on: '2026-11-02' } as never)).error).toBeNull();

    await deleteAccount(as(admin), u);
    expect((await admin.auth.admin.getUserById(u)).data.user).toBeNull();
    expect(await fileExists(path)).toBe(true);
    expect((await admin.from('scans').select('created_by').eq('id', scanId).single()).data).toEqual({ created_by: null });
    expect((await admin.from('wears').select('id').eq('collection_id', c.cid)).data).toHaveLength(2);
  });
});
