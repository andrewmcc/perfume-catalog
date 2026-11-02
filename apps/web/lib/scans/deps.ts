import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@perfume/supabase';
import { extractWithClaude } from '@perfume/core';
import type { ExtractFn } from './extract-scan';

/** Service-role db and the real Claude extract, for the scan routes. */
export function scanDeps() {
  const client = new Anthropic();
  const extract: ExtractFn = (mode, photos) => extractWithClaude(client, mode, photos);
  return { db: createServiceClient(), extract };
}

/** Runs tasks with at most `limit` in flight. */
export async function runLimited<T>(items: T[], limit: number, task: (item: T) => Promise<unknown>): Promise<void> {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await task(item).catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}
