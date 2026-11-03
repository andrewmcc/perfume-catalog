import { describe, expect, it, vi } from 'vitest';
import { pickToday, type Candidate, type TodayContext } from '@perfume/core';
import { modelReasons } from '../model-reasons';
import { candidatesOf, parseNudge, parseOccasion } from '../load';

vi.mock('@/lib/weather/cached', () => ({ getWeather: async () => null }));

const cand = (id: string): Candidate => ({ perfumeId: id, itemId: `i-${id}`, house: 'H', name: id, family: null, seasons: [], times: [], occasions: [], weight: null, sillage: null, sample: false, lastWorn: null, sizeMl: null, setName: null });
const ctx: TodayContext = { date: '2026-11-02', daypart: 'day', season: 'autumn', tempC: null, nudge: null, occasion: null };
const picks = pickToday([cand('a'), cand('b')], ctx);

describe('modelReasons', () => {
  it('returns the reasons by id', async () => {
    expect(await modelReasons(picks, ctx, null, async () => new Map([['a', 'Nice']]))).toEqual({ a: 'Nice' });
  });
  it('a throw or a timeout gives null (rule reasons stay)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await modelReasons(picks, ctx, null, async () => { throw new Error('529'); })).toBeNull();
    expect(await modelReasons(picks, ctx, null, () => new Promise(() => {}), 20)).toBeNull();
    expect(err).toHaveBeenCalledWith('today reasons', 'timeout');
    err.mockRestore();
  });
  it('no picks: no call', async () => {
    const suggest = vi.fn();
    expect(await modelReasons([], ctx, null, suggest)).toEqual({});
    expect(suggest).not.toHaveBeenCalled();
  });
});

describe('Today params and candidates', () => {
  it('parses nudges and occasions, ignoring unknown values', () => {
    expect([parseNudge('lighter'), parseNudge('louder'), parseNudge(undefined)]).toEqual(['lighter', null, null]);
    expect([parseOccasion('date'), parseOccasion('wedding')]).toEqual(['date', null]);
  });
  it('one candidate per perfume with an owned item; samples-only is a sample; gone-only is skipped', () => {
    const row = (id: string, items: { id: string; format: string; status: string }[]) =>
      ({ perfumeId: id, house: 'H', name: id, concentration: null, family: null, sillage: null, seasons: [], times: [], occasions: [], accords: [], notes: { top: [], heart: [], base: [] }, weight: null, thumb: null, wear: { count: 0, avgRating: null, lastWorn: null }, items: items.map((i) => ({ ...i, size_ml: 2, setId: null, setName: null })) });
    const out = candidatesOf([
      row('bottle', [{ id: 's', format: 'sample', status: 'owned' }, { id: 'f', format: 'full', status: 'owned' }]),
      row('vial', [{ id: 'v', format: 'sample', status: 'owned' }]),
      row('gone', [{ id: 'g', format: 'full', status: 'gone' }]),
    ]);
    expect(out.map((c) => [c.perfumeId, c.itemId, c.sample])).toEqual([['bottle', 'f', false], ['vial', 'v', true]]);
  });
});

describe('reasons cache key', () => {
  it('keeps only what the prompt reads', async () => {
    const { reasonsKey } = await import('../model-reasons');
    const [a] = pickToday([cand('a')], ctx);
    const b = { ...a!, score: a!.score + 1, candidate: { ...a!.candidate, itemId: 'other', sizeMl: 100, setName: 'Set', times: ['day'] } };
    expect(reasonsKey([b])).toEqual(reasonsKey([a!]));
    expect(reasonsKey([{ ...a!, candidate: { ...a!.candidate, name: 'Renamed' } }])).not.toEqual(reasonsKey([a!]));
  });
});
