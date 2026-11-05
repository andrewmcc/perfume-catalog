import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { EXTRACTION_MODEL } from '../extraction/claude.js';
import { normalizeSuggestion, type PerfumeSuggestion } from './merge.js';
import { enrichmentPrompt } from './prompt.js';
import { PerfumeSuggestionSchema, type RawSuggestion } from './schema.js';

type Identity = { house: string; name: string; concentration: string | null };

/** Searches per request; one paused turn may be resumed, so at most twice this in total. */
export const ENRICH_MAX_SEARCHES = 3;

/** True when a suggestion has any top, heart or base note. */
export const hasNotes = (s: PerfumeSuggestion) => s.notes_top.length + s.notes_heart.length + s.notes_base.length > 0;

/**
 * Asks Claude for a perfume's known facts. With `search`, Claude may look the perfume up on the
 * web first (for niche perfumes it doesn't know). Throws on API error, refusal or unparseable output.
 */
export async function suggestPerfume(client: Anthropic, p: Identity, opts: { search?: boolean } = {}): Promise<PerfumeSuggestion> {
  const base = {
    model: EXTRACTION_MODEL,
    max_tokens: opts.search ? 6000 : 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
    output_config: { format: betaZodOutputFormat(PerfumeSuggestionSchema) },
    // A search lookup re-reads its growing search results on every iteration (and again on a pause_turn resume):
    // caching lets those re-reads come from cache. A plain lookup is one short prompt, so it skips the write.
    ...(opts.search
      ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: ENRICH_MAX_SEARCHES }], cache_control: { type: 'ephemeral' as const } }
      : {}),
  };
  const prompt = { role: 'user' as const, content: enrichmentPrompt(p, opts) };
  let response = await client.beta.messages.parse({ ...base, messages: [prompt] });
  // A long server-side search loop can pause; send it back once to finish.
  if (response.stop_reason === 'pause_turn') {
    response = await client.beta.messages.parse({ ...base, messages: [prompt, { role: 'assistant', content: response.content }] });
  }
  if (response.stop_reason === 'refusal') throw new Error(`refused: ${response.stop_details?.category ?? 'unknown'}`);
  if (!response.parsed_output) throw new Error(`unparseable output (stop_reason ${response.stop_reason})`);
  return normalizeSuggestion(response.parsed_output as RawSuggestion);
}
