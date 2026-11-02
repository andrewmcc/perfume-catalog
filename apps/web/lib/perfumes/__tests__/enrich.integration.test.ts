import { afterAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@perfume/supabase';
import { normalizeSuggestion, type PerfumeSuggestion } from '@perfume/core';
import { enrichPerfume } from '../enrich';

type Db = SupabaseClient<Database>;
const db: Db = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const house = `Zztest Enrich ${crypto.randomUUID().slice(0, 8)}`;

const raw = {
  perfumers: ['Chris Maurice'],
  release_year: 2015,
  house_type: 'niche',
  family: 'oriental',
  subfamily: '',
  accords: ['honey', 'tobacco'],
  notes_top: ['lavender'],
  notes_heart: ['honey'],
  notes_base: ['tobacco'],
  longevity: 'long',
  sillage: 'strong',
  seasons: ['autumn', 'winter'],
  times_of_day: ['evening'],
  occasions: [],
  gender_marketing: 'unisex',
  discontinued: 'unknown',
  typical_price_per_ml: 2.6,
} as const;
const suggestion: PerfumeSuggestion = normalizeSuggestion(raw as never);

afterAll(async () => {
  await db.from('perfumes').delete().eq('house', house);
});

describe('enrichPerfume', () => {
  it('fills nulls with ai sources and leaves label fields alone', async () => {
    const { data: p } = await db
      .from('perfumes')
      .insert({ house, name: 'Naxos', concentration: 'edp', family: 'woody', sources: { house: 'label', name: 'label', concentration: 'label', family: 'label' } })
      .select('id')
      .single();
    const calls: unknown[] = [];
    await enrichPerfume(p!.id, { db, suggest: async (x) => (calls.push(x), suggestion) });
    expect(calls).toEqual([{ house, name: 'Naxos', concentration: 'edp' }]);
    const { data: row } = await db.from('perfumes').select('*').eq('id', p!.id).single();
    expect(row).toMatchObject({ family: 'woody', notes_top: ['lavender'], seasons: ['autumn', 'winter'], release_year: 2015, typical_price_per_ml: 2.6, discontinued: null, occasions: [] });
    expect(row!.sources).toMatchObject({ house: 'label', name: 'label', family: 'label', notes_top: 'ai', seasons: 'ai', release_year: 'ai' });
    expect(row!.sources).not.toHaveProperty('occasions');
  });

  it('memory with no notes falls back to web search; search fills what memory left empty', async () => {
    const { data: p } = await db.from('perfumes').insert({ house, name: 'Obscure' }).select('id').single();
    const blank = normalizeSuggestion({ ...(raw as never as object), family: 'gourmand', notes_top: [], notes_heart: [], notes_base: [], accords: [], perfumers: [], seasons: [] } as never);
    const searched: unknown[] = [];
    await enrichPerfume(p!.id, { db, suggest: async () => blank, search: async (x) => (searched.push(x), suggestion) });
    expect(searched).toEqual([{ house, name: 'Obscure', concentration: null }]);
    const { data: row } = await db.from('perfumes').select('*').eq('id', p!.id).single();
    expect(row).toMatchObject({ family: 'gourmand', notes_top: ['lavender'], notes_base: ['tobacco'] });
    expect(row!.sources).toMatchObject({ family: 'ai', notes_top: 'ai' });
  });

  it('memory with notes does not search', async () => {
    const { data: p } = await db.from('perfumes').insert({ house, name: 'Famous' }).select('id').single();
    let searched = false;
    await enrichPerfume(p!.id, { db, suggest: async () => suggestion, search: async () => ((searched = true), suggestion) });
    expect(searched).toBe(false);
  });

  it('a failing search keeps what memory found', async () => {
    const { data: p } = await db.from('perfumes').insert({ house, name: 'Half' }).select('id').single();
    const blank = normalizeSuggestion({ ...(raw as never as object), notes_top: [], notes_heart: [], notes_base: [] } as never);
    await enrichPerfume(p!.id, { db, suggest: async () => blank, search: async () => { throw new Error('search down'); } });
    const { data: row } = await db.from('perfumes').select('family').eq('id', p!.id).single();
    expect(row!.family).toBe('oriental');
  });

  it('null id is a no-op; a failing suggest is swallowed', async () => {
    let called = false;
    await enrichPerfume(null, { db, suggest: async () => ((called = true), suggestion) });
    expect(called).toBe(false);
    const { data: p } = await db.from('perfumes').insert({ house, name: 'Broken' }).select('id').single();
    await expect(enrichPerfume(p!.id, { db, suggest: async () => { throw new Error('boom'); } })).resolves.toBeUndefined();
  });
});
