import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient, type Database } from '@perfume/supabase';
import { fillMissing, suggestPerfume, type PerfumeSuggestion } from '@perfume/core';
import { CLAUDE_MAX_RETRIES, CLAUDE_TIMEOUT_MS } from '@/lib/scans/budget';

type Suggest = (p: { house: string; name: string; concentration: string | null }) => Promise<PerfumeSuggestion>;
type Deps = { db: SupabaseClient<Database>; suggest: Suggest };

function defaultDeps(): Deps {
  const client = new Anthropic({ timeout: CLAUDE_TIMEOUT_MS, maxRetries: CLAUDE_MAX_RETRIES });
  return { db: createServiceClient(), suggest: (p) => suggestPerfume(client, p) };
}

/** Fills a newly created perfume's empty fields with AI suggestions (service role). Logs and swallows errors. */
export async function enrichPerfume(id: string | null, deps: Deps = defaultDeps()): Promise<void> {
  if (!id) return;
  try {
    const { data: p, error } = await deps.db.from('perfumes').select('*').eq('id', id).single();
    if (error) throw error;
    const suggestion = await deps.suggest({ house: p.house, name: p.name, concentration: p.concentration });
    const { update, sources } = fillMissing({ ...p, sources: (p.sources ?? {}) as Record<string, string> }, suggestion);
    if (Object.keys(update).length === 0) return;
    const { error: uErr } = await deps.db
      .from('perfumes')
      .update({ ...update, sources } as Database['public']['Tables']['perfumes']['Update'])
      .eq('id', id);
    if (uErr) throw uErr;
  } catch (e) {
    console.error('enrich', id, e instanceof Error ? e.message : String(e));
  }
}
