import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { PROMPTS } from './extract-prompt';
import { RESULT_SCHEMAS, type BottleResult, type Mode, type SamplesResult, type SetResult } from './extract-schema';

export const EXTRACTION_MODEL = 'claude-sonnet-5-5';

/** Reads a capture's photos (base64 JPEG) with Claude. Throws on API error, refusal or unparseable output. */
export async function extractCapture(
  client: Anthropic,
  mode: Mode,
  photos: string[],
): Promise<BottleResult | SamplesResult | SetResult> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  photos.forEach((data, i) => {
    content.push(
      { type: 'text', text: `Photo ${i + 1}:` },
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
    );
  });
  content.push({ type: 'text', text: PROMPTS[mode] });

  const response = await client.beta.messages.parse({
    model: EXTRACTION_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { format: betaZodOutputFormat(RESULT_SCHEMAS[mode]) },
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(`refused: ${response.stop_details?.category ?? 'unknown'}`);
  }
  if (!response.parsed_output) throw new Error(`unparseable output (stop_reason ${response.stop_reason})`);
  return response.parsed_output as BottleResult | SamplesResult | SetResult;
}
