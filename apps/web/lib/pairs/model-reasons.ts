import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { cacheLife } from 'next/cache';
import { createServiceClient } from '@perfume/supabase';
import { suggestPairReasons } from '@perfume/core';
import { claimAi } from '@/lib/ai/quota';
import type { Pairs } from './select';

export const PAIR_REASONS_TIMEOUT_MS = 8_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Cached per collection and pairing (the arguments are the key). The quota is claimed only on a
 * miss; a refused claim throws, so nothing is cached and the rule reasons stay.
 */
async function cachedPairReasons(collectionId: string, pairs: Pairs): Promise<Record<string, string>> {
  'use cache';
  cacheLife('days');
  if (!(await claimAi(createServiceClient(), collectionId, 'pair_reasons'))) throw new Error('pair reasons quota used up');
  const client = new Anthropic({ timeout: PAIR_REASONS_TIMEOUT_MS, maxRetries: 0 });
  return Object.fromEntries(await withTimeout(suggestPairReasons(client, pairs.target, pairs.likes, pairs.layers), PAIR_REASONS_TIMEOUT_MS));
}

/** Model-written pair lines by key ("like:<id>" / "layer:<id>"), or null on any failure. */
export async function pairReasons(collectionId: string, pairs: Pairs): Promise<Record<string, string> | null> {
  if (!pairs.likes.length && !pairs.layers.length) return {};
  try {
    return await cachedPairReasons(collectionId, pairs);
  } catch (e) {
    console.error('pair reasons', e instanceof Error ? e.message : String(e));
    return null;
  }
}
