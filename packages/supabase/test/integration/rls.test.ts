import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  admin, anonClient, createTestCollection, createTestUser, deleteTestCollection, deleteTestUser, hasCredentials, type Client,
} from './helpers';

type U = { id: string; client: Client };

describe.skipIf(!hasCredentials)('collection RLS', () => {
  let A: U, B: U, C: U;
  let CA: string, CB: string;
  let aPerfume: string, aSet: string, aItem: string, aScan: string, aPhoto: string, aResult: string;
  const sharedHouse = `zz-test-${crypto.randomUUID().slice(0, 8)}`;
  let shared: { id: string };

  beforeAll(async () => {
    [A, B, C] = await Promise.all([createTestUser(), createTestUser(), createTestUser()]);
    CA = await createTestCollection([A.id, C.id]);
    CB = await createTestCollection([B.id]);

    const sh = await admin().from('perfumes').insert({ house: sharedHouse, name: 'Shared One', concentration: 'edp' }).select('id').single();
    if (sh.error) throw sh.error;
    shared = sh.data;
  });

  afterAll(async () => {
    // Collections first: items (which restrict-reference perfumes) cascade away with them.
    if (CA) await deleteTestCollection(CA);
    if (CB) await deleteTestCollection(CB);
    const { error } = await admin().from('perfumes').delete().like('house', 'zz-test-%');
    if (error) throw error;
    await Promise.all([A, B, C].filter(Boolean).map((u) => deleteTestUser(u.id)));
  });

  it("member can insert and read own collection's set, item, scan", async () => {
    const p = await A.client.from('perfumes').insert({ collection_id: CA, house: 'zz-test-priv', name: 'Private' }).select('id').single();
    expect(p.error).toBeNull();
    aPerfume = p.data!.id;

    const s = await A.client.from('sets').insert({ collection_id: CA, name: 'Set' }).select('id').single();
    expect(s.error).toBeNull();
    aSet = s.data!.id;

    const i = await A.client.from('items').insert({ collection_id: CA, perfume_id: aPerfume, set_id: aSet }).select('id').single();
    expect(i.error).toBeNull();
    aItem = i.data!.id;

    const sc = await A.client
      .from('scans')
      .insert({ id: crypto.randomUUID(), collection_id: CA, created_by: A.id, mode: 'bottle', photo_paths: [`${CA}/x/1.jpg`] })
      .select('id')
      .single();
    expect(sc.error).toBeNull();
    aScan = sc.data!.id;

    // item_photos and scan_results are written by the server in practice; seed via admin for B-visibility checks.
    const ph = await admin().from('item_photos').insert({ item_id: aItem, collection_id: CA, storage_path: `${CA}/x/1.jpg` }).select('id').single();
    if (ph.error) throw ph.error;
    aPhoto = ph.data.id;
    const sr = await admin().from('scan_results').insert({ scan_id: aScan, collection_id: CA, position: 0, kind: 'bottle', read: {} }).select('id').single();
    if (sr.error) throw sr.error;
    aResult = sr.data.id;

    for (const [table, id] of [['sets', aSet], ['items', aItem], ['scans', aScan]] as const) {
      const r = await A.client.from(table).select('id').eq('id', id);
      expect(r.data).toHaveLength(1);
    }
  });

  it("B sees zero rows of CA's sets, items, item_photos, scans, scan_results, collection_members", async () => {
    for (const table of ['sets', 'items', 'item_photos', 'scans', 'scan_results', 'collection_members'] as const) {
      const r = await B.client.from(table).select('*').eq('collection_id', CA);
      expect(r.error).toBeNull();
      expect(r.data).toEqual([]);
    }
    // Unfiltered too.
    const all = await B.client.from('items').select('id');
    expect(all.data!.find((x) => x.id === aItem)).toBeUndefined();
    // A sees own membership rows though.
    const own = await A.client.from('collection_members').select('user_id').eq('collection_id', CA);
    expect(own.data!.length).toBe(2);
  });

  it("B cannot update or delete A's item", async () => {
    const u = await B.client.from('items').update({ notes: 'hacked' }).eq('id', aItem).select('id');
    expect(u.data ?? []).toEqual([]);
    const d = await B.client.from('items').delete().eq('id', aItem).select('id');
    expect(d.data ?? []).toEqual([]);
    const row = await admin().from('items').select('notes').eq('id', aItem).single();
    expect(row.data!.notes).toBeNull();
  });

  it('B cannot insert an item with collection_id = CA', async () => {
    const r = await B.client.from('items').insert({ collection_id: CA, perfume_id: aPerfume });
    expect(r.error?.code).toBe('42501');
  });

  it('shared perfume is readable by A and B; insert/update/delete of a shared perfume by A is rejected or affects 0 rows', async () => {
    for (const u of [A, B]) {
      const r = await u.client.from('perfumes').select('id').eq('id', shared.id);
      expect(r.data).toHaveLength(1);
    }
    const ins = await A.client.from('perfumes').insert({ collection_id: null, house: 'zz-test-sneaky', name: 'x' });
    expect(ins.error?.code).toBe('42501');
    const upd = await A.client.from('perfumes').update({ name: 'changed' }).eq('id', shared.id).select('id');
    expect(upd.data ?? []).toEqual([]);
    const del = await A.client.from('perfumes').delete().eq('id', shared.id).select('id');
    expect(del.data ?? []).toEqual([]);
    const row = await admin().from('perfumes').select('name').eq('id', shared.id).single();
    expect(row.data!.name).toBe('Shared One');
  });

  it("A's private perfume (collection_id = CA) is invisible to B; B cannot insert a perfume with collection_id = CA", async () => {
    const r = await B.client.from('perfumes').select('id').eq('id', aPerfume);
    expect(r.data).toEqual([]);
    const ins = await B.client.from('perfumes').insert({ collection_id: CA, house: 'zz-test-b', name: 'x' });
    expect(ins.error?.code).toBe('42501');
  });

  it('anon client reads no perfumes', async () => {
    const r = await anonClient().from('perfumes').select('id');
    expect(r.error?.code === '42501' || (r.data ?? []).length === 0).toBe(true);
  });

  it('client cannot update scans.status', async () => {
    const r = await A.client.from('scans').update({ status: 'reviewed' }).eq('id', aScan).select('id');
    expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
    const row = await admin().from('scans').select('status').eq('id', aScan).single();
    expect(row.data!.status).toBe('uploaded');
  });

  it("second member of CA (user C) sees A's items", async () => {
    const r = await C.client.from('items').select('id').eq('id', aItem);
    expect(r.data).toHaveLength(1);
  });

  it('duplicate shared perfume with same normalised house/name/concentration is rejected', async () => {
    const dup = await admin().from('perfumes').insert({ house: sharedHouse.toUpperCase(), name: 'shared  ONE', concentration: 'edp' });
    expect(dup.error?.code).toBe('23505');
    // Same name in a collection is fine (separate uniqueness scope).
    const ok = await admin().from('perfumes').insert({ collection_id: CB, house: sharedHouse, name: 'Shared One', concentration: 'edp' });
    expect(ok.error).toBeNull();
    expect(aPhoto && aResult).toBeTruthy();
  });
});
