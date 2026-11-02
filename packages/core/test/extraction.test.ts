import { describe, expect, it } from 'vitest';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  BottleResultSchema,
  SamplesResultSchema,
  SetResultSchema,
  isPerfume,
  isStuck,
  nextStatus,
  normalizeResult,
  promptFor,
  resultsToRows,
  type BottleResult,
  type SamplesResult,
  type SetResult,
} from '../src/index';

const rawRead = (over: Record<string, unknown> = {}) => ({
  house: 'Chanel',
  name: 'No. 5',
  concentration: 'edp',
  flanker_or_edition: '',
  size_ml: 50,
  status: { house: 'clear', name: 'clear', concentration: 'clear' },
  alternatives: [],
  identified_from: 'label',
  ...over,
});
const rawBottle = (over: Record<string, unknown> = {}) => ({
  is_perfume: true,
  perfume: rawRead(),
  format: 'full',
  batch_code: '',
  other_text: '',
  ...over,
});
const rawSamples = (n: number, flag = true) => ({ is_perfume_photo: flag, vials: Array.from({ length: n }, () => rawRead()), unreadable_count: 0 });
const rawSet = (n: number, flag = true) => ({
  is_discovery_set: flag,
  set_house: 'Le Labo',
  set_name: 'Discovery',
  status: { set_name: 'clear' },
  scents: Array.from({ length: n }, () => rawRead({ house: '' })),
});

/** Union-typed parameters in the JSON schema the SDK actually sends. */
function countUnions(schema: Parameters<typeof betaZodOutputFormat>[0]): number {
  const json = JSON.stringify(betaZodOutputFormat(schema).schema);
  return (json.match(/"anyOf"/g) ?? []).length + (json.match(/"type":\[/g) ?? []).length;
}

describe('normalizeResult', () => {
  it('turns "" sentinels into null', () => {
    const r = normalizeResult('bottle', rawBottle()) as BottleResult;
    expect(r.perfume.flanker_or_edition).toBeNull();
    expect(r.batch_code).toBeNull();
    expect(r.other_text).toBeNull();
  });
  it('turns size_ml 0 into null', () => {
    const r = normalizeResult('bottle', rawBottle({ perfume: rawRead({ size_ml: 0, concentration: '' }) })) as BottleResult;
    expect(r.perfume.size_ml).toBeNull();
    expect(r.perfume.concentration).toBeNull();
  });
  it('keeps printed values', () => {
    const r = normalizeResult('bottle', rawBottle()) as BottleResult;
    expect(r.perfume).toMatchObject({ house: 'Chanel', name: 'No. 5', concentration: 'edp', size_ml: 50, identified_from: 'label' });
  });
  it('truncates alternatives to 2 and drops empty ones', () => {
    const r = normalizeResult('bottle', rawBottle({ perfume: rawRead({ alternatives: ['A', '', 'B', 'C'] }) })) as BottleResult;
    expect(r.perfume.alternatives).toEqual(['A', 'B']);
  });
  it('normalises set house and name sentinels', () => {
    const r = normalizeResult('set', { ...rawSet(1), set_name: '' }) as SetResult;
    expect(r.set_name).toBeNull();
    expect(r.scents[0]!.house).toBeNull();
  });
  it('throws on output that does not match the schema', () => {
    expect(() => normalizeResult('samples', { vials: 'x' })).toThrow();
  });
});

describe('structured-outputs limit', () => {
  it.each([
    ['bottle', BottleResultSchema],
    ['samples', SamplesResultSchema],
    ['set', SetResultSchema],
  ] as const)('%s schema sends at most 16 union parameters', (_m, schema) => {
    expect(countUnions(schema)).toBeLessThanOrEqual(16);
  });
});

describe('isPerfume', () => {
  it('follows each mode flag', () => {
    expect(isPerfume('bottle', normalizeResult('bottle', rawBottle()))).toBe(true);
    expect(isPerfume('bottle', normalizeResult('bottle', rawBottle({ is_perfume: false })))).toBe(false);
    expect(isPerfume('samples', normalizeResult('samples', rawSamples(1)))).toBe(true);
    expect(isPerfume('samples', normalizeResult('samples', rawSamples(0, false)))).toBe(false);
    expect(isPerfume('set', normalizeResult('set', rawSet(1)))).toBe(true);
    expect(isPerfume('set', normalizeResult('set', rawSet(0, false)))).toBe(false);
  });
});

describe('resultsToRows', () => {
  it('bottle gives 1 bottle row', () => {
    const rows = resultsToRows('bottle', normalizeResult('bottle', rawBottle()));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe('bottle');
    expect(rows[0]!.read.name).toBe('No. 5');
  });
  it('samples with 3 vials gives 3 vial rows', () => {
    const rows = resultsToRows('samples', normalizeResult('samples', rawSamples(3)) as SamplesResult);
    expect(rows.map((r) => r.kind)).toEqual(['vial', 'vial', 'vial']);
  });
  it('set with 0 scents gives []', () => {
    expect(resultsToRows('set', normalizeResult('set', rawSet(0)))).toEqual([]);
  });
  it('set with 2 scents gives 2 set_scent rows', () => {
    expect(resultsToRows('set', normalizeResult('set', rawSet(2))).map((r) => r.kind)).toEqual(['set_scent', 'set_scent']);
  });
});

describe('nextStatus', () => {
  it('perfume result → extracted', () => {
    expect(nextStatus({ mode: 'bottle', result: normalizeResult('bottle', rawBottle()) }, 1)).toEqual({ status: 'extracted' });
  });
  it('flag false → discarded with not perfume', () => {
    expect(nextStatus({ mode: 'bottle', result: normalizeResult('bottle', rawBottle({ is_perfume: false })) }, 1)).toEqual({
      status: 'discarded',
      error: 'not perfume',
    });
  });
  it('error at attempt 1 → retry', () => {
    expect(nextStatus({ error: 'boom' }, 1)).toEqual({ status: 'retry', error: 'boom' });
  });
  it('error at attempt 2 → failed', () => {
    expect(nextStatus({ error: 'boom' }, 2)).toEqual({ status: 'failed', error: 'boom' });
  });
});

describe('isStuck', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
  it('uploaded: stuck after 2 minutes', () => {
    expect(isStuck({ status: 'uploaded', updated_at: ago(1) }, now)).toBe(false);
    expect(isStuck({ status: 'uploaded', updated_at: ago(3) }, now)).toBe(true);
  });
  it('processing: stuck after 10 minutes', () => {
    expect(isStuck({ status: 'processing', updated_at: ago(9) }, now)).toBe(false);
    expect(isStuck({ status: 'processing', updated_at: ago(11) }, now)).toBe(true);
  });
  it('other statuses never stuck', () => {
    for (const status of ['extracted', 'failed', 'discarded', 'reviewed']) {
      expect(isStuck({ status, updated_at: ago(60) }, now)).toBe(false);
    }
  });
});

describe('promptFor', () => {
  it('bottle prompt covers alternatives and branding', () => {
    const p = promptFor('bottle');
    expect(p).toContain('alternatives');
    expect(p).toMatch(/Logos, monograms, crests/);
  });
  it('set prompt never lists scents from memory', () => {
    expect(promptFor('set')).toMatch(/never list scents from memory/i);
  });
});
