import { describe, expect, it } from 'vitest';
import { headline, heft, idealHeft, pickToday, reasonLine, type Candidate, type TodayContext } from '../src/index.js';

const cand = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  perfumeId: id,
  itemId: `item-${id}`,
  house: 'House',
  name: `Perfume ${id}`,
  family: null,
  seasons: [],
  times: [],
  occasions: [],
  weight: null,
  sillage: null,
  sample: false,
  lastWorn: '2026-10-01',
  sizeMl: null,
  setName: null,
  ...over,
});
const ctx = (over: Partial<TodayContext> = {}): TodayContext => ({ date: '2026-11-02', daypart: 'day', season: 'autumn', tempC: null, nudge: null, occasion: null, ...over });
const ids = (cs: Candidate[], c: TodayContext, n = 3) => pickToday(cs, c, n).map((p) => p.candidate.perfumeId);

const citrus = cand('citrus', { family: 'citrus', weight: 'top', sillage: 'intimate', seasons: ['summer'] });
const oriental = cand('oriental', { family: 'oriental', weight: 'base', sillage: 'strong', seasons: ['winter'], times: ['evening'] });

describe('heft and ideal', () => {
  it('heft adds family, weight and sillage, clamped', () => {
    expect(heft(citrus)).toBe(-2);
    expect(heft(oriental)).toBe(2);
    expect(heft(cand('x'))).toBe(0);
  });
  it('ideal from temperature, evening adds one, nudges shift, clamped', () => {
    expect(idealHeft(ctx({ tempC: 25 }))).toBe(-2);
    expect(idealHeft(ctx({ tempC: 12 }))).toBe(0);
    expect(idealHeft(ctx({ tempC: 9, daypart: 'evening' }))).toBe(2);
    expect(idealHeft(ctx({ tempC: null, season: 'summer' }))).toBe(-1);
    expect(idealHeft(ctx({ tempC: 12, nudge: 'lighter' }))).toBe(-2);
    expect(idealHeft(ctx({ tempC: 2, nudge: 'bolder' }))).toBe(2);
  });
});

describe('pickToday', () => {
  it('summer heat prefers citrus over oriental', () => {
    expect(ids([oriental, citrus], ctx({ season: 'summer', tempC: 25 }), 1)).toEqual(['citrus']);
  });
  it('a cold winter evening prefers the base-heavy one', () => {
    expect(ids([citrus, oriental], ctx({ season: 'winter', daypart: 'evening', tempC: 2 }), 1)).toEqual(['oriental']);
  });
  it('the lighter nudge flips a mild-day winner', () => {
    const c = ctx({ season: 'autumn', tempC: 12 });
    const warm = cand('warm', { family: 'woody', weight: 'base', sillage: 'strong' });
    const fresh = cand('fresh', { family: 'green', weight: 'top' });
    expect(ids([warm, fresh], ctx({ ...c, nudge: 'bolder' }), 1)).toEqual(['warm']);
    expect(ids([warm, fresh], ctx({ ...c, nudge: 'lighter' }), 1)).toEqual(['fresh']);
  });
  it('an occasion match wins and gives the reason', () => {
    const office = cand('office', { occasions: ['office'] });
    const date = cand('date', { occasions: ['date'] });
    const [p] = pickToday([office, date], ctx({ occasion: 'date' }), 1);
    expect(p!.candidate.perfumeId).toBe('date');
    expect(p!.reasons[0]).toEqual({ code: 'occasion' });
  });
  it('an untried sample gets the boost and its reason', () => {
    const [p] = pickToday([cand('a'), cand('s', { sample: true, lastWorn: null })], ctx(), 1);
    expect(p!.candidate.perfumeId).toBe('s');
    expect(p!.reasons.map((r) => r.code)).toContain('untried_sample');
  });
  it('worn today drops out of the top 3 when there are alternatives', () => {
    const cs = ['a', 'b', 'c', 'd'].map((id) => cand(id));
    cs[0] = cand('a', { lastWorn: '2026-11-02', seasons: ['autumn'] });
    expect(ids(cs, ctx())).not.toContain('a');
  });
  it('neglected gives weeks = floor(days / 7)', () => {
    const [p] = pickToday([cand('n', { lastWorn: '2026-09-01' })], ctx(), 1);
    expect(p!.reasons).toContainEqual({ code: 'neglected', weeks: 8 });
  });
  it('no metadata still returns 3 picks; fewer candidates return fewer', () => {
    expect(ids(['a', 'b', 'c', 'd', 'e'].map((id) => cand(id)), ctx())).toHaveLength(3);
    expect(ids([cand('a'), cand('b')], ctx())).toHaveLength(2);
    expect(pickToday([], ctx())).toEqual([]);
  });
  it('the order changes across dates for equal candidates', () => {
    const cs = ['a', 'b', 'c', 'd', 'e'].map((id) => cand(id, { lastWorn: null }));
    const firsts = new Set(Array.from({ length: 10 }, (_, i) => ids(cs, ctx({ date: `2026-11-${String(10 + i)}` }), 1)[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });
  it('the same family loses a point after the first pick', () => {
    // Three equal scores: without the penalty floral would miss the top two on some dates.
    const cs = [cand('w1', { family: 'woody' }), cand('w2', { family: 'woody' }), cand('f', { family: 'floral' })];
    for (let d = 10; d < 20; d++) expect(ids(cs, ctx({ date: `2026-11-${d}` }), 2)).toContain('f');
  });
});

describe('copy', () => {
  it('reason lines use at most two phrases, strongest first', () => {
    const c = ctx({ occasion: 'date', season: 'autumn' });
    const [p] = pickToday([cand('d', { occasions: ['date'], seasons: ['autumn'], times: ['day'], lastWorn: '2026-09-01' })], c, 1);
    expect(reasonLine(p!, c)).toBe('Good for a date · Not worn in 8 weeks');
  });
  it('reason copy for each code', () => {
    const line = (over: Partial<Candidate>, c: TodayContext) => reasonLine(pickToday([cand('x', over)], c, 1)[0]!, c);
    expect(line({ sample: true, lastWorn: null }, ctx())).toBe('Untried sample');
    expect(line({ seasons: ['autumn'] }, ctx())).toBe('Made for autumn');
    expect(line({ times: ['evening'] }, ctx({ daypart: 'evening' }))).toBe('An evening scent');
    expect(line({ family: 'oriental', weight: 'base', sillage: 'strong' }, ctx({ tempC: 2, season: 'winter' }))).toBe('Right for 2°C · Warm and heavy');
    expect(line({ family: 'citrus', weight: 'top' }, ctx({ season: 'summer' }))).toBe('Fresh and light');
    expect(line({}, ctx())).toBe('A change of pace');
  });
  it('headlines for a hot day and a cold night', () => {
    expect(headline(ctx({ tempC: 26, season: 'summer' }))).toEqual({ title: 'Today, something light and bright', sub: 'Hot day, so light and bright.' });
    expect(headline(ctx({ tempC: 3, daypart: 'night', season: 'winter' }))).toEqual({ title: 'Tonight, something with presence', sub: 'Cold night, so base-heavy and bold.' });
    expect(headline(ctx({ tempC: null, daypart: 'evening', season: 'autumn' })).sub).toBe('Autumn evening, so warm and rounded.');
  });
});
