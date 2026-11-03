import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';
import { loadYearCounts } from '../load';

type Db = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Db = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
let user: Db;
let cid = '';
let uid = '';
let pid = '';

beforeAll(async () => {
  const email = `year-test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  uid = (await admin.auth.admin.createUser({ email, password, email_confirm: true })).data.user!.id;
  cid = (await admin.from('collections').insert({ name: `zz-test-${crypto.randomUUID()}` }).select('id').single()).data!.id;
  await admin.from('collection_members').insert({ collection_id: cid, user_id: uid, role: 'owner' });
  pid = (await admin.from('perfumes').insert({ house: `Zztest Year ${uid.slice(0, 8)}`, name: 'Y', collection_id: cid }).select('id').single()).data!.id;
  const item = (await admin.from('items').insert({ collection_id: cid, perfume_id: pid }).select('id').single()).data!.id;
  const w = (worn_on: string) => ({ collection_id: cid, item_id: item, perfume_id: pid, worn_on });
  const { error } = await admin.from('wears').insert([w('2025-12-31'), w('2026-01-01'), w('2026-01-01'), w('2026-07-15'), w('2026-12-31'), w('2027-01-01')]);
  if (error) throw error;
  user = createClient<Database>(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
  await user.auth.signInWithPassword({ email, password });
});
afterAll(async () => {
  await admin.from('collections').delete().eq('id', cid);
  await admin.from('perfumes').delete().eq('id', pid);
  await admin.auth.admin.deleteUser(uid);
});

describe('loadYearCounts', () => {
  it('counts wears per day within the year only', async () => {
    const counts = await loadYearCounts(user as unknown as Parameters<typeof loadYearCounts>[0], 2026);
    expect(Object.fromEntries(counts)).toEqual({ '2026-01-01': 2, '2026-07-15': 1, '2026-12-31': 1 });
  });
});
