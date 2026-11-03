import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { cacheLife } from 'next/cache';
import { suggestReasons, type Pick, type TodayContext } from '@perfume/core';

export const REASONS_TIMEOUT_MS = 8_000;

type Suggest = (picks: Pick[], ctx: TodayContext, conditions: string | null) => Promise<Map<string, string>>;

const defaultSuggest: Suggest = (picks, ctx, conditions) =>
  suggestReasons(new Anthropic({ timeout: REASONS_TIMEOUT_MS, maxRetries: 0 }), picks, ctx, conditions);

function withTimeout<T>(p: Promise<T>, ms = REASONS_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The picks as the prompt reads them: fields it never uses are blanked so they don't split the
 * cache (item, size, set, sillage, times, occasions, score).
 */
export function reasonsKey(picks: Pick[]): Pick[] {
  return picks.map((p) => ({
    score: 0,
    reasons: p.reasons,
    candidate: { ...p.candidate, itemId: '', sizeMl: null, setName: null, sillage: null, times: [], occasions: [] },
  }));
}

/** Cached per day and context: the arguments (date, daypart, nudge, occasion, weather, picks) are the key. */
async function cachedReasons(picks: Pick[], ctx: TodayContext, conditions: string | null): Promise<Record<string, string>> {
  'use cache';
  cacheLife('days');
  return Object.fromEntries(await withTimeout(defaultSuggest(picks, ctx, conditions)));
}

/**
 * Model-written reason lines by perfume id, or null on any failure (the rule reasons stay).
 * `suggest` is for tests and scripts; it bypasses the cache.
 */
export async function modelReasons(
  picks: Pick[],
  ctx: TodayContext,
  conditions: string | null,
  suggest?: Suggest,
  timeoutMs = REASONS_TIMEOUT_MS,
): Promise<Record<string, string> | null> {
  if (!picks.length) return {};
  try {
    return suggest ? Object.fromEntries(await withTimeout(suggest(picks, ctx, conditions), timeoutMs)) : await cachedReasons(reasonsKey(picks), ctx, conditions);
  } catch (e) {
    console.error('today reasons', e instanceof Error ? e.message : String(e));
    return null;
  }
}
