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

    const scanId = crypto.randomUUID();
    const sc = await A.client
      .from('scans')
      .insert({ id: scanId, collection_id: CA, created_by: A.id, mode: 'bottle', photo_paths: [`${CA}/${scanId}/1.jpg`] })
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

  describe('cross-collection references and pinned behaviour', () => {
    let bPerfume: string, bSet: string, bItem: string, bScan: string;

    beforeAll(async () => {
      const p = await admin().from('perfumes').insert({ collection_id: CB, house: 'zz-test-bx', name: 'B Private' }).select('id').single();
      if (p.error) throw p.error;
      bPerfume = p.data.id;
      const st = await admin().from('sets').insert({ collection_id: CB, name: 'B set' }).select('id').single();
      if (st.error) throw st.error;
      bSet = st.data.id;
      const it = await admin().from('items').insert({ collection_id: CB, perfume_id: bPerfume }).select('id').single();
      if (it.error) throw it.error;
      bItem = it.data.id;
      bScan = crypto.randomUUID();
      const sc = await admin().from('scans').insert({ id: bScan, collection_id: CB, mode: 'bottle', photo_paths: [`${CB}/${bScan}/1.jpg`] });
      if (sc.error) throw sc.error;
    });

    const rejected = (e: { code?: string } | null) => expect(e).not.toBeNull();

    it("A cannot create an item in CA pointing at CB's private perfume", async () => {
      const r = await A.client.from('items').insert({ collection_id: CA, perfume_id: bPerfume });
      rejected(r.error);
      expect(['42501', '23503']).toContain(r.error!.code);
    });

    it("A cannot update an existing item to point at CB's private perfume", async () => {
      const r = await A.client.from('items').update({ perfume_id: bPerfume }).eq('id', aItem).select('id');
      expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
      const row = await admin().from('items').select('perfume_id').eq('id', aItem).single();
      expect(row.data!.perfume_id).toBe(aPerfume);
    });

    it("A cannot create an item in CA with set_id of CB's set", async () => {
      const r = await A.client.from('items').insert({ collection_id: CA, perfume_id: shared.id, set_id: bSet });
      rejected(r.error);
    });

    it("A cannot create item_photos in CA with item_id of CB's item", async () => {
      const r = await A.client.from('item_photos').insert({ item_id: bItem, collection_id: CA, storage_path: `${CA}/y/1.jpg` });
      rejected(r.error);
    });

    it('A cannot create item_photos with storage_path under CB/', async () => {
      const r = await A.client.from('item_photos').insert({ item_id: aItem, collection_id: CA, storage_path: `${CB}/y/1.jpg` });
      rejected(r.error);
      const t = await A.client.from('item_photos').insert({ item_id: aItem, collection_id: CA, storage_path: `${CA}/y/1.jpg`, thumb_path: `${CB}/y/t.jpg` });
      rejected(t.error);
    });

    it("A cannot insert a scan whose photo_paths are outside CA/<scan id>/", async () => {
      const id = crypto.randomUUID();
      const base = { id, collection_id: CA, created_by: A.id, mode: 'bottle' as const };
      for (const photo_paths of [[`${CB}/${id}/1.jpg`], [`${CA}/${crypto.randomUUID()}/1.jpg`], [], [`${CA}/${id}/1.jpg`, `${CB}/${id}/2.jpg`], [`${CA}/${id}/1.jpg`, `${CA}/${id}/2.jpg`, `${CA}/${id}/3.jpg`]]) {
        const r = await A.client.from('scans').insert({ ...base, photo_paths });
        rejected(r.error);
      }
      const ok = await A.client.from('scans').insert({ ...base, photo_paths: [`${CA}/${id}/1.jpg`, `${CA}/${id}/2.jpg`] });
      expect(ok.error).toBeNull();
    });

    it('scan_results cannot point at another collection\'s scan or item (admin insert)', async () => {
      const r = await admin().from('scan_results').insert({ scan_id: bScan, collection_id: CA, position: 0, kind: 'bottle', read: {} });
      rejected(r.error);
      const r2 = await admin().from('scan_results').insert({ scan_id: aScan, collection_id: CA, position: 1, kind: 'bottle', read: {}, created_item_id: bItem });
      rejected(r2.error);
    });

    it("A cannot update CA's private perfume to collection_id = null or move it to CB", async () => {
      const toShared = await A.client.from('perfumes').update({ collection_id: null }).eq('id', aPerfume).select('id');
      expect(toShared.error !== null || (toShared.data ?? []).length === 0).toBe(true);
      const toCB = await A.client.from('perfumes').update({ collection_id: CB }).eq('id', aPerfume).select('id');
      expect(toCB.error !== null || (toCB.data ?? []).length === 0).toBe(true);
      const row = await admin().from('perfumes').select('collection_id').eq('id', aPerfume).single();
      expect(row.data!.collection_id).toBe(CA);
    });

    it('a referenced private perfume cannot change collection even via service role', async () => {
      const r = await admin().from('perfumes').update({ collection_id: CB }).eq('id', aPerfume);
      rejected(r.error);
    });

    it('client insert into scans that includes status or extraction is rejected', async () => {
      for (const extra of [{ status: 'reviewed' }, { extraction: { x: 1 } }]) {
        const id = crypto.randomUUID();
        const r = await A.client.from('scans').insert({ id, collection_id: CA, created_by: A.id, mode: 'bottle', photo_paths: [`${CA}/${id}/1.jpg`], ...extra } as never);
        rejected(r.error);
      }
    });

    it('deleting collection CB succeeds even after A attempted cross references', async () => {
      const { error } = await admin().from('collections').delete().eq('id', CB);
      expect(error).toBeNull();
      const left = await admin().from('items').select('id').eq('collection_id', CB);
      expect(left.data).toEqual([]);
    });
  });
});
