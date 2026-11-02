import { afterAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';
import { claimLookup } from '../lookup';

const db: SupabaseClient<Database> = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const house = `Zztest Lookup ${crypto.randomUUID().slice(0, 8)}`;
afterAll(async () => {
  await db.from('perfumes').delete().eq('house', house);
});

describe('claimLookup', () => {
  it('one claim per perfume per day, even when two arrive together', async () => {
    const { data: p } = await db.from('perfumes').insert({ house, name: 'Once' }).select('id').single();
    const now = new Date('2026-11-03T10:00:00Z');
    const [a, b] = await Promise.all([claimLookup(db, p!.id, now), claimLookup(db, p!.id, now)]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(await claimLookup(db, p!.id, new Date('2026-11-04T09:59:00Z'))).toBe(false);
    expect(await claimLookup(db, p!.id, new Date('2026-11-04T10:01:00Z'))).toBe(true);
  });
});
