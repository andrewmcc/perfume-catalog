import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { EXTRACTION_MODEL } from '../extraction/claude.js';
import { normalizeSuggestion, type PerfumeSuggestion } from './merge.js';
import { enrichmentPrompt } from './prompt.js';
import { PerfumeSuggestionSchema, type RawSuggestion } from './schema.js';

/** Asks Claude (text only) for a perfume's known facts. Throws on API error, refusal or unparseable output. */
export async function suggestPerfume(client: Anthropic, p: { house: string; name: string; concentration: string | null }): Promise<PerfumeSuggestion> {
  const response = await client.beta.messages.parse({
    model: EXTRACTION_MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { format: betaZodOutputFormat(PerfumeSuggestionSchema) },
    messages: [{ role: 'user', content: enrichmentPrompt(p) }],
  });
  if (response.stop_reason === 'refusal') throw new Error(`refused: ${response.stop_details?.category ?? 'unknown'}`);
  if (!response.parsed_output) throw new Error(`unparseable output (stop_reason ${response.stop_reason})`);
  return normalizeSuggestion(response.parsed_output as RawSuggestion);
}
