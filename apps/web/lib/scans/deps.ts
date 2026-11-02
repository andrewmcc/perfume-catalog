import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@perfume/supabase';
import { extractWithClaude } from '@perfume/core';
import { CLAUDE_MAX_RETRIES, CLAUDE_TIMEOUT_MS } from './budget';
import type { ExtractFn } from './extract-scan';

/** Service-role db and the real Claude extract, for the scan routes. */
export function scanDeps() {
  const client = new Anthropic({ timeout: CLAUDE_TIMEOUT_MS, maxRetries: CLAUDE_MAX_RETRIES });
  const extract: ExtractFn = (mode, photos) => extractWithClaude(client, mode, photos);
  return { db: createServiceClient(), extract };
}
