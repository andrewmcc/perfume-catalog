import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BottleResult, Concentration, Mode, PerfumeRead, SamplesResult, SetResult } from '../extract-schema';

// Structured outputs allow at most 16 union-typed parameters per schema.
function countUnionParams(schema: z.ZodType): number {
  const json = JSON.stringify(z.toJSONSchema(schema));
  return (json.match(/"anyOf"/g) ?? []).length + (json.match(/"type":\[/g) ?? []).length;
}

const read = {
  house: 'Chanel',
  name: 'No. 5',
  concentration: 'edp',
  flanker_or_edition: '',
  size_ml: 50,
  status: { house: 'clear', name: 'clear', concentration: 'clear' },
};

describe('Mode', () => {
  it('accepts the three modes only', () => {
    expect(Mode.parse('bottle')).toBe('bottle');
    expect(Mode.parse('samples')).toBe('samples');
    expect(Mode.parse('set')).toBe('set');
    expect(Mode.safeParse('box').success).toBe(false);
  });
});

describe('Concentration', () => {
  it('rejects upper case and accepts the empty string', () => {
    expect(Concentration.safeParse('EDP').success).toBe(false);
    expect(Concentration.safeParse('').success).toBe(true);
    expect(Concentration.safeParse('edp').success).toBe(true);
  });
});

describe('schemas parse representative valid objects', () => {
  it('PerfumeRead', () => {
    expect(PerfumeRead.safeParse(read).success).toBe(true);
  });

  it('BottleResult', () => {
    const r = BottleResult.safeParse({
      is_perfume: true,
      perfume: read,
      format: 'full',
      batch_code: '7141',
      identified_from: 'label',
      other_text: 'Paris',
    });
    expect(r.success).toBe(true);
  });

  it('SamplesResult, including empty vials', () => {
    expect(SamplesResult.safeParse({ is_perfume_photo: true, vials: [read, read], unreadable_count: 1 }).success).toBe(true);
    expect(SamplesResult.safeParse({ is_perfume_photo: false, vials: [], unreadable_count: 0 }).success).toBe(true);
  });

  it('SetResult, including empty scents', () => {
    const set = {
      is_discovery_set: true,
      set_house: 'Jo Malone',
      set_name: 'Cologne Collection',
      status: { set_name: 'clear' },
      scents: [{ ...read, house: '' }],
    };
    expect(SetResult.safeParse(set).success).toBe(true);
    expect(SetResult.safeParse({ ...set, is_discovery_set: false, scents: [] }).success).toBe(true);
  });
});

describe('structured-outputs limit', () => {
  it.each([
    ['BottleResult', BottleResult],
    ['SamplesResult', SamplesResult],
    ['SetResult', SetResult],
  ])('%s has at most 16 union parameters', (_name, schema) => {
    expect(countUnionParams(schema)).toBeLessThanOrEqual(16);
  });
});
