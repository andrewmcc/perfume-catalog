import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';
import type { Mode } from '@perfume/core';
import { extractScan, type ExtractFn } from '../extract-scan';

// Hosted DB, fake extract function. Users A and B are in collections CA and CB.
type Db = SupabaseClient<Database>;
const db: Db = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const read = (name = 'No. 5') => ({
  house: 'Chanel',
  name,
  concentration: 'edp',
  flanker_or_edition: '',
  size_ml: 50,
  status: { house: 'clear', name: 'clear', concentration: 'clear' },
  alternatives: [],
  identified_from: 'label',
});
const bottle = (isPerfume = true) => ({ is_perfume: isPerfume, perfume: read(), format: 'full', batch_code: '', other_text: '' });
const samples = (n: number) => ({ is_perfume_photo: true, vials: Array.from({ length: n }, (_, i) => read(`Vial ${i}`)), unreadable_count: 0 });

const fake = (result: unknown): ExtractFn & { calls: number } => {
  const fn = (async () => {
    fn.calls++;
    return result;
  }) as unknown as ExtractFn & { calls: number };
  fn.calls = 0;
  return fn;
};

let userA = '';
let userB = '';
let ca = '';
let cb = '';

async function user(): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({ email: `scan-test-${crypto.randomUUID()}@example.com`, password: crypto.randomUUID(), email_confirm: true });
  if (error) throw error;
  return data.user.id;
}
async function collection(member: string): Promise<string> {
  const { data, error } = await db.from('collections').insert({ name: `zz-test-${crypto.randomUUID()}` }).select('id').single();
  if (error) throw error;
  const { error: mErr } = await db.from('collection_members').insert({ collection_id: data.id, user_id: member, role: 'owner' });
  if (mErr) throw mErr;
  return data.id;
}
/** Uploads a tiny photo and inserts an uploaded scan. */
async function scan(collectionId: string, createdBy: string, mode: Mode = 'bottle'): Promise<string> {
  const id = crypto.randomUUID();
  const path = `${collectionId}/${id}/photo-1.jpg`;
  const { error: upErr } = await db.storage.from('photos').upload(path, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }));
  if (upErr) throw upErr;
  const { error } = await db.from('scans').insert({ id, collection_id: collectionId, created_by: createdBy, mode, photo_paths: [path] });
  if (error) throw error;
  return id;
}
const row = async (id: string) => (await db.from('scans').select('*').eq('id', id).single()).data!;
const results = async (id: string) => (await db.from('scan_results').select('*').eq('scan_id', id).order('position')).data!;

beforeAll(async () => {
  userA = await user();
  userB = await user();
  ca = await collection(userA);
  cb = await collection(userB);
});

afterAll(async () => {
  for (const c of [ca, cb].filter(Boolean)) {
    const { data } = await db.storage.from('photos').list(c);
    for (const dir of data ?? []) {
      const { data: files } = await db.storage.from('photos').list(`${c}/${dir.name}`);
      await db.storage.from('photos').remove((files ?? []).map((f) => `${c}/${dir.name}/${f.name}`));
    }
    await db.from('collections').delete().eq('id', c);
  }
  for (const u of [userA, userB].filter(Boolean)) await db.auth.admin.deleteUser(u);
});

describe('extractScan', () => {
  it('B gets not_found for CA scan; row untouched', async () => {
    const id = await scan(ca, userA);
    const extract = fake(bottle());
    expect(await extractScan({ db, extract }, id, userB, 'explicit')).toBe('not_found');
    expect(extract.calls).toBe(0);
    const r = await row(id);
    expect(r.status).toBe('uploaded');
    expect(r.attempts).toBe(0);
  });

  it('missing scan is not_found', async () => {
    expect(await extractScan({ db, extract: fake(bottle()) }, crypto.randomUUID(), userA, 'explicit')).toBe('not_found');
  });

  it('bottle success writes extraction, status extracted, attempts 1, one bottle row', async () => {
    const id = await scan(ca, userA);
    expect(await extractScan({ db, extract: fake(bottle()) }, id, userA, 'explicit')).toBe('extracted');
    const r = await row(id);
    expect(r).toMatchObject({ status: 'extracted', attempts: 1, error: null });
    expect((r.extraction as { perfume: { name: string } }).perfume.name).toBe('No. 5');
    expect(r.model).toBeTruthy();
    const rows = await results(id);
    expect(rows.map((x) => x.kind)).toEqual(['bottle']);
    expect(rows[0]).toMatchObject({ collection_id: ca, position: 0, status: 'pending' });
    expect((rows[0]!.read as { flanker_or_edition: unknown }).flanker_or_edition).toBeNull();
  });

  it('samples success with 3 vials writes 3 vial rows', async () => {
    const id = await scan(ca, userA, 'samples');
    expect(await extractScan({ db, extract: fake(samples(3)) }, id, userA, 'explicit')).toBe('extracted');
    expect((await results(id)).map((x) => [x.kind, x.position])).toEqual([
      ['vial', 0],
      ['vial', 1],
      ['vial', 2],
    ]);
  });

  it("flag false → discarded, error 'not perfume', no results", async () => {
    const id = await scan(ca, userA);
    expect(await extractScan({ db, extract: fake(bottle(false)) }, id, userA, 'explicit')).toBe('discarded');
    expect(await row(id)).toMatchObject({ status: 'discarded', error: 'not perfume' });
    expect(await results(id)).toEqual([]);
  });

  it('extract throws twice → failed, attempts 2, error stored; never left processing', async () => {
    const id = await scan(ca, userA);
    let calls = 0;
    const extract: ExtractFn = async () => {
      calls++;
      throw new Error(`boom ${calls}`);
    };
    expect(await extractScan({ db, extract }, id, userA, 'explicit')).toBe('failed');
    expect(calls).toBe(2);
    expect(await row(id)).toMatchObject({ status: 'failed', attempts: 2, error: 'boom 2' });
  });

  it('unparseable output fails like a thrown error', async () => {
    const id = await scan(ca, userA);
    expect(await extractScan({ db, extract: fake({ nonsense: true }) }, id, userA, 'explicit')).toBe('failed');
    expect((await row(id)).status).toBe('failed');
  });

  it('two concurrent calls: exactly one extracts, the other is not_claimed', async () => {
    const id = await scan(ca, userA);
    let calls = 0;
    const extract: ExtractFn = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 300));
      return bottle();
    };
    const outcomes = await Promise.all([extractScan({ db, extract }, id, userA, 'explicit'), extractScan({ db, extract }, id, userA, 'explicit')]);
    expect(outcomes.sort()).toEqual(['extracted', 'not_claimed']);
    expect(calls).toBe(1);
  });

  it('explicit re-claims a failed scan; sweep does not', async () => {
    const id = await scan(ca, userA);
    await db.from('scans').update({ status: 'failed', error: 'old' }).eq('id', id);
    expect(await extractScan({ db, extract: fake(bottle()) }, id, userA, 'sweep')).toBe('not_claimed');
    expect(await extractScan({ db, extract: fake(bottle()) }, id, userA, 'explicit')).toBe('extracted');
  });

  it('sweep does not claim a fresh upload', async () => {
    const id = await scan(ca, userA);
    expect(await extractScan({ db, extract: fake(bottle()) }, id, userA, 'sweep')).toBe('not_claimed');
  });

  it('re-extract replaces pending results', async () => {
    const id = await scan(ca, userA, 'samples');
    await extractScan({ db, extract: fake(samples(3)) }, id, userA, 'explicit');
    await db.from('scans').update({ status: 'failed' }).eq('id', id);
    await extractScan({ db, extract: fake(samples(2)) }, id, userA, 'explicit');
    expect(await results(id)).toHaveLength(2);
  });
});
