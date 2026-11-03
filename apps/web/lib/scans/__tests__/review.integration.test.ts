import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';

// Hosted DB. Members A (collection CA) and B (collection CB); RPCs run with each member's session.
type Db = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Db = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);

const tag = crypto.randomUUID().slice(0, 8);
const house = `Zztest House ${tag}`;
type Read = Record<string, unknown>;
const read = (name: string, over: Read = {}): Read => ({
  house,
  name,
  concentration: 'edp',
  flanker_or_edition: null,
  size_ml: 50,
  status: { house: 'clear', name: 'clear', concentration: 'clear' },
  alternatives: [],
  identified_from: 'label',
  ...over,
});

let a: Db;
let b: Db;
let ca = '';
let cb = '';
const users: string[] = [];

async function member(): Promise<{ client: Db; cid: string }> {
  const email = `review-test-${crypto.randomUUID()}@example.com`;
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

type Kind = 'bottle' | 'vial' | 'set_scent';
/** An extracted scan with one pending result per read. Returns the scan id and result ids. */
async function extracted(cid: string, mode: 'bottle' | 'samples' | 'set', reads: Read[], extra: Read = {}) {
  const id = crypto.randomUUID();
  const kind: Kind = mode === 'bottle' ? 'bottle' : mode === 'samples' ? 'vial' : 'set_scent';
  const extraction =
    mode === 'bottle'
      ? { is_perfume: true, perfume: reads[0], format: 'travel', batch_code: 'B123', other_text: null, ...extra }
      : mode === 'samples'
        ? { is_perfume_photo: true, vials: reads, unreadable_count: 0 }
        : { is_discovery_set: true, set_house: house, set_name: 'Discovery Set', status: { set_name: 'clear' }, scents: reads };
  const { error } = await admin.from('scans').insert({
    id,
    collection_id: cid,
    mode,
    photo_paths: [`${cid}/${id}/photo-1.jpg`],
    status: 'extracted',
    extraction: extraction as never,
  });
  if (error) throw error;
  const { data, error: rErr } = await admin
    .from('scan_results')
    .insert(reads.map((r, position) => ({ scan_id: id, collection_id: cid, position, kind, read: r as never })))
    .select('id, position');
  if (rErr) throw rErr;
  return { id, results: data.sort((x, y) => x.position - y.position).map((r) => r.id) };
}

const approve = (client: Db, resultId: string, input: Read = {}) => client.rpc('approve_result', { p_result_id: resultId, p_input: input as never });
const scanRow = async (id: string) => (await admin.from('scans').select('*').eq('id', id).single()).data!;
const resultRow = async (id: string) => (await admin.from('scan_results').select('*').eq('id', id).single()).data!;
const item = async (id: string) => (await admin.from('items').select('*, perfumes(*), item_photos(*)').eq('id', id).single()).data!;
const perfumesNamed = async (name: string) => (await admin.from('perfumes').select('*').eq('house', house).eq('name', name)).data!;

beforeAll(async () => {
  ({ client: a, cid: ca } = await member());
  ({ client: b, cid: cb } = await member());
});

afterAll(async () => {
  await admin.storage.from('photos').remove([]);
  for (const c of [ca, cb].filter(Boolean)) {
    const { data } = await admin.storage.from('photos').list(c);
    for (const dir of data ?? []) {
      const { data: files } = await admin.storage.from('photos').list(`${c}/${dir.name}`);
      await admin.storage.from('photos').remove((files ?? []).map((f) => `${c}/${dir.name}/${f.name}`));
    }
    await admin.from('collections').delete().eq('id', c);
  }
  await admin.from('perfumes').delete().like('house', 'Zztest House%');
  for (const u of users) await admin.auth.admin.deleteUser(u);
});

describe('approve_result', () => {
  it('creates a shared perfume with label sources, the item and its photo; result approved; scan reviewed', async () => {
    const s = await extracted(ca, 'bottle', [read('Shared One')]);
    const { data, error } = await approve(a, s.results[0]!);
    expect(error).toBeNull();
    const row = data![0]!;
    expect(row.created_perfume_id).toBeTruthy();
    const it = await item(row.item_id);
    expect(it.perfumes!.collection_id).toBeNull();
    expect(it.perfumes!.sources).toMatchObject({ house: 'label', name: 'label', concentration: 'label' });
    expect(it).toMatchObject({ collection_id: ca, format: 'travel', size_ml: 50, batch_code: 'B123', status: 'owned' });
    expect(it.item_photos.map((p) => p.storage_path)).toEqual([`${ca}/${s.id}/photo-1.jpg`]);
    expect(it.item_photos[0]!.thumb_path).toBeNull();
    expect(await resultRow(s.results[0]!)).toMatchObject({ status: 'approved', created_item_id: row.item_id });
    expect((await scanRow(s.id)).status).toBe('reviewed');
  });

  it('an edited name gives a private perfume with sources.name edited', async () => {
    const s = await extracted(ca, 'bottle', [read('Typo Nmae')]);
    const { data, error } = await approve(a, s.results[0]!, { name: 'Edited Name', edited_fields: ['name'] });
    expect(error).toBeNull();
    const p = (await item(data![0]!.item_id)).perfumes!;
    expect(p).toMatchObject({ name: 'Edited Name', collection_id: ca });
    expect(p.sources).toMatchObject({ name: 'edited', house: 'label' });
  });

  it('a changed name without edited_fields is still treated as edited (private)', async () => {
    const s = await extracted(ca, 'bottle', [read('Honest Read')]);
    const { data, error } = await approve(a, s.results[0]!, { name: 'Sneaky Name', edited_fields: [] });
    expect(error).toBeNull();
    const p = (await item(data![0]!.item_id)).perfumes!;
    expect(p).toMatchObject({ name: 'Sneaky Name', collection_id: ca });
    expect(p.sources).toMatchObject({ name: 'edited' });
  });

  it('an edited concentration alone gives a private perfume', async () => {
    const s = await extracted(ca, 'bottle', [read('Conc Edit')]);
    const { data, error } = await approve(a, s.results[0]!, { concentration: 'extrait' });
    expect(error).toBeNull();
    const p = (await item(data![0]!.item_id)).perfumes!;
    expect(p).toMatchObject({ concentration: 'extrait', collection_id: ca });
    expect(p.sources).toMatchObject({ concentration: 'edited' });
  });

  it('identified_from shape gives a private perfume', async () => {
    const s = await extracted(ca, 'bottle', [read('Shape Only', { identified_from: 'shape' })]);
    const { data } = await approve(a, s.results[0]!);
    expect((await item(data![0]!.item_id)).perfumes!.collection_id).toBe(ca);
  });

  it('a second approve fails with result not pending; parallel approves create one item', async () => {
    const s = await extracted(ca, 'bottle', [read('Twice')]);
    expect((await approve(a, s.results[0]!)).error).toBeNull();
    expect((await approve(a, s.results[0]!)).error?.message).toContain('result not pending');

    const p = await extracted(ca, 'bottle', [read('Parallel')]);
    const both = await Promise.all([approve(a, p.results[0]!), approve(a, p.results[0]!)]);
    expect(both.filter((r) => r.error === null)).toHaveLength(1);
    expect(both.find((r) => r.error)!.error!.message).toContain('result not pending');
    const { count } = await admin.from('scan_results').select('*', { count: 'exact', head: true }).eq('scan_id', p.id).eq('status', 'approved');
    expect(count).toBe(1);
  });

  it('refuses another collection; ignores crafted keys', async () => {
    const s = await extracted(ca, 'bottle', [read('Crafted')]);
    expect((await approve(b, s.results[0]!)).error?.message).toContain('result not pending');
    expect((await resultRow(s.results[0]!)).status).toBe('pending');

    const { data: other } = await admin.from('perfumes').insert({ house, name: 'Other Private', collection_id: cb }).select('id').single();
    const { data, error } = await approve(a, s.results[0]!, {
      collection_id: cb,
      perfume_id: other!.id,
      photo_paths: [`${cb}/x/photo-1.jpg`],
      status: 'gone',
    });
    expect(error).toBeNull();
    const it = await item(data![0]!.item_id);
    expect(it.collection_id).toBe(ca);
    expect(it.perfume_id).not.toBe(other!.id);
    expect(it.status).toBe('owned');
    expect(it.item_photos[0]!.storage_path.startsWith(`${ca}/`)).toBe(true);
  });

  it('matches name variants and concentration present vs missing', async () => {
    const first = await extracted(ca, 'bottle', [read('Naxos Variant')]);
    const { data: d1 } = await approve(a, first.results[0]!);
    const pid = (await item(d1![0]!.item_id)).perfume_id;

    const upper = await extracted(ca, 'bottle', [read('NAXOS  variant ', { house: `${house.toUpperCase()} `, concentration: null })]);
    const { data: d2, error } = await approve(a, upper.results[0]!);
    expect(error).toBeNull();
    expect(d2![0]!.created_perfume_id).toBeNull();
    expect((await item(d2![0]!.item_id)).perfume_id).toBe(pid);

    const noConc = await extracted(ca, 'bottle', [read('Bare Name', { concentration: null })]);
    const { data: d3 } = await approve(a, noConc.results[0]!);
    const bare = (await item(d3![0]!.item_id)).perfume_id;
    const withConc = await extracted(ca, 'bottle', [read("Bare Name", { concentration: 'edt' })]);
    const { data: d4 } = await approve(a, withConc.results[0]!);
    expect((await item(d4![0]!.item_id)).perfume_id).toBe(bare);
    expect(await perfumesNamed('Naxos Variant')).toHaveLength(1);
  });

  it('a flanker is a different perfume', async () => {
    const base = await extracted(ca, 'bottle', [read('Flank Base')]);
    const { data: d1 } = await approve(a, base.results[0]!);
    const elixir = await extracted(ca, 'bottle', [read('Flank Base', { flanker_or_edition: 'Elixir' })]);
    const { data: d2, error } = await approve(a, elixir.results[0]!);
    expect(error).toBeNull();
    expect(d2![0]!.created_perfume_id).toBeTruthy();
    expect((await item(d2![0]!.item_id)).perfume_id).not.toBe((await item(d1![0]!.item_id)).perfume_id);
    const again = await extracted(ca, 'bottle', [read('Flank Base', { flanker_or_edition: 'ELIXIR ' })]);
    const { data: d3 } = await approve(a, again.results[0]!);
    expect((await item(d3![0]!.item_id)).perfume_id).toBe((await item(d2![0]!.item_id)).perfume_id);
  });

  it('accented and unaccented spellings match', async () => {
    const first = await extracted(ca, 'bottle', [read('Eau de Peau Ébène')]);
    const { data: d1 } = await approve(a, first.results[0]!);
    const caps = await extracted(ca, 'bottle', [read('EAU DE PEAU EBENE')]);
    const { data: d2 } = await approve(a, caps.results[0]!);
    expect(d2![0]!.created_perfume_id).toBeNull();
    expect((await item(d2![0]!.item_id)).perfume_id).toBe((await item(d1![0]!.item_id)).perfume_id);
  });

  it('a set approved sequentially and in parallel creates one set with every item linked', async () => {
    const s = await extracted(ca, 'set', ['Set A', 'Set B', 'Set C', 'Set D', 'Set E'].map((n) => read(n, { size_ml: 2 })));
    for (const r of s.results.slice(0, 3)) expect((await approve(a, r)).error).toBeNull();
    const par = await Promise.all(s.results.slice(3).map((r) => approve(a, r)));
    expect(par.every((r) => r.error === null)).toBe(true);
    const { data: sets } = await admin.from('sets').select('*').eq('collection_id', ca).eq('name', 'Discovery Set');
    expect(sets).toHaveLength(1);
    expect(sets![0]!.house).toBe(house);
    const { data: items } = await admin.from('items').select('set_id, format').in('id', (await admin.from('scan_results').select('created_item_id').eq('scan_id', s.id)).data!.map((r) => r.created_item_id!));
    expect(items).toHaveLength(5);
    expect(items!.every((i) => i.set_id === sets![0]!.id && i.format === 'sample')).toBe(true);
    expect((await scanRow(s.id)).created_set_id).toBe(sets![0]!.id);
  });

  it('vials are samples', async () => {
    const s = await extracted(ca, 'samples', [read('Vial One', { size_ml: null })]);
    const { data } = await approve(a, s.results[0]!);
    expect((await item(data![0]!.item_id)).format).toBe('sample');
  });

  it('sets thumb_path when thumb-1.jpg exists', async () => {
    const s = await extracted(ca, 'bottle', [read('Thumbed')]);
    const thumb = `${ca}/${s.id}/thumb-1.jpg`;
    const { error: upErr } = await admin.storage.from('photos').upload(thumb, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }));
    expect(upErr).toBeNull();
    const { data } = await approve(a, s.results[0]!);
    expect((await item(data![0]!.item_id)).item_photos[0]!.thumb_path).toBe(thumb);
  });

  it('status wishlist makes a wishlist item; other statuses are ignored', async () => {
    const s = await extracted(ca, 'samples', [read('Wished'), read('Not Gone')]);
    const w = await approve(a, s.results[0]!, { status: 'wishlist' });
    expect((await item(w.data![0]!.item_id)).status).toBe('wishlist');
    const g = await approve(a, s.results[1]!, { status: 'gone' });
    expect((await item(g.data![0]!.item_id)).status).toBe('owned');
  });

  it('requires house and name', async () => {
    const s = await extracted(ca, 'bottle', [read('', { name: null })]);
    expect((await approve(a, s.results[0]!)).error?.message).toContain('house and name required');
  });
});

describe('discard_result and dismiss_scan', () => {
  it('discarding the last pending result reviews the scan; non-member refused', async () => {
    const s = await extracted(ca, 'samples', [read('Keep Vial'), read('Drop Vial')]);
    expect((await b.rpc('discard_result', { p_result_id: s.results[1]! })).error).not.toBeNull();
    expect((await a.rpc('discard_result', { p_result_id: s.results[1]! })).error).toBeNull();
    expect((await resultRow(s.results[1]!)).status).toBe('discarded');
    expect((await scanRow(s.id)).status).toBe('extracted');
    await approve(a, s.results[0]!);
    expect((await scanRow(s.id)).status).toBe('reviewed');
  });

  it('dismiss_scan discards pending results and reviews the scan', async () => {
    const s = await extracted(ca, 'samples', [read('Dismiss A'), read('Dismiss B')]);
    expect((await b.rpc('dismiss_scan', { p_scan_id: s.id })).error).not.toBeNull();
    expect((await a.rpc('dismiss_scan', { p_scan_id: s.id })).error).toBeNull();
    expect((await scanRow(s.id)).status).toBe('reviewed');
    expect((await resultRow(s.results[0]!)).status).toBe('discarded');
  });
});

describe('review_lookup', () => {
  it('returns the matched perfume and duplicate flag; nothing for another collection', async () => {
    const first = await extracted(ca, 'bottle', [read('Lookup Dup')]);
    await approve(a, first.results[0]!);
    const again = await extracted(ca, 'bottle', [read('Lookup Dup')]);
    const fresh = await extracted(ca, 'bottle', [read('Lookup Fresh')]);
    const { data, error } = await a.rpc('review_lookup', { p_scan_ids: [again.id, fresh.id] });
    expect(error).toBeNull();
    const by = Object.fromEntries(data!.map((r) => [r.result_id, r]));
    expect(by[again.results[0]!]).toMatchObject({ duplicate: true });
    expect(by[again.results[0]!]!.perfume_id).toBeTruthy();
    expect(by[fresh.results[0]!]).toMatchObject({ perfume_id: null, duplicate: false });
    const { data: bs } = await b.rpc('review_lookup', { p_scan_ids: [again.id] });
    expect(bs).toEqual([]);
  });
});

describe('claim_scan', () => {
  it('explicit claim takes an extracted scan', async () => {
    const s = await extracted(ca, 'bottle', [read('Reread')]);
    const { data } = await admin.rpc('claim_scan', { p_id: s.id, p_claim: 'explicit' });
    expect(data).toHaveLength(1);
    expect((await scanRow(s.id)).status).toBe('processing');
  });
});
