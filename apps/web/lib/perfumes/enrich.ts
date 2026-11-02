import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient, type Database } from '@perfume/supabase';
import { fillMissing, suggestPerfume, type PerfumeSuggestion } from '@perfume/core';
import { CLAUDE_MAX_RETRIES, CLAUDE_TIMEOUT_MS } from '@/lib/scans/budget';

type Identity = { house: string; name: string; concentration: string | null };
type Suggest = (p: Identity) => Promise<PerfumeSuggestion>;
type Deps = { db: SupabaseClient<Database>; suggest: Suggest; search?: Suggest };

/**
 * Per search request (a paused search turn is resumed once, so up to twice this). Searching takes
 * 18–31 s in practice. Memory (≤ 2 × 55 s) plus search (≤ 2 × 80 s) stays inside a 300 s function.
 */
export const ENRICH_SEARCH_TIMEOUT_MS = 80_000;

function defaultDeps(): Deps {
  const client = new Anthropic({ timeout: CLAUDE_TIMEOUT_MS, maxRetries: CLAUDE_MAX_RETRIES });
  const searcher = new Anthropic({ timeout: ENRICH_SEARCH_TIMEOUT_MS, maxRetries: 0 });
  return {
    db: createServiceClient(),
    suggest: (p) => suggestPerfume(client, p),
    search: (p) => suggestPerfume(searcher, p, { search: true }),
  };
}

/** Does the perfume row (after any fills so far) have a top, heart or base note? */
export const rowHasNotes = (r: Record<string, unknown>) =>
  (['notes_top', 'notes_heart', 'notes_base'] as const).some((k) => ((r[k] as string[] | null) ?? []).length > 0);

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Fills a perfume's empty fields with AI suggestions (service role); never overwrites a value.
 * Asks from memory first; when that gives no notes (or fails), looks the perfume up on the web.
 * Logs and swallows errors.
 */
export async function enrichPerfume(id: string | null, deps: Deps = defaultDeps()): Promise<void> {
  if (!id) return;
  try {
    const { data: p, error } = await deps.db.from('perfumes').select('*').eq('id', id).single();
    if (error) throw error;
    const who: Identity = { house: p.house, name: p.name, concentration: p.concentration };

    let row: Record<string, unknown> = { ...p };
    let sources = (p.sources ?? {}) as Record<string, string>;
    const update: Record<string, unknown> = {};
    const apply = (s: PerfumeSuggestion) => {
      const r = fillMissing({ ...row, sources }, s);
      Object.assign(update, r.update);
      row = { ...row, ...r.update };
      sources = r.sources;
    };

    try {
      apply(await deps.suggest(who));
    } catch (e) {
      console.error('enrich', id, errText(e));
    }
    if (deps.search && !rowHasNotes(row)) {
      try {
        apply(await deps.search(who));
      } catch (e) {
        console.error('enrich search', id, errText(e));
      }
    }

    if (Object.keys(update).length === 0) return;
    const { error: uErr } = await deps.db
      .from('perfumes')
      .update({ ...update, sources } as Database['public']['Tables']['perfumes']['Update'])
      .eq('id', id);
    if (uErr) throw uErr;
  } catch (e) {
    console.error('enrich', id, errText(e));
  }
}
