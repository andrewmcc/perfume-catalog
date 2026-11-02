import { describe, expect, it } from 'vitest';
import type { BottleResult, PerfumeRead, SamplesResult, SetResult } from '@perfume/core';
import { summarise } from '../summarise';

const perfume = (over: Partial<PerfumeRead> = {}): PerfumeRead => ({
  house: 'Xerjoff',
  name: 'Naxos',
  concentration: null,
  flanker_or_edition: null,
  size_ml: null,
  status: { house: 'clear', name: 'clear', concentration: 'absent' },
  alternatives: [],
  identified_from: 'label',
  ...over,
});
const bottle = (p: PerfumeRead, isPerfume = true): BottleResult => ({ is_perfume: isPerfume, perfume: p, format: 'full', batch_code: null, other_text: null });

describe('summarise', () => {
  it('set with empty scents is recognised and asks for the scent list', () => {
    const r: SetResult = { is_discovery_set: true, set_house: 'Matiere Premiere', set_name: null, status: { set_name: 'absent' }, scents: [] };
    const s = summarise('set', r);
    expect(s.recognised).toBe(true);
    expect(s.lines.join('\n')).toContain('no scent list visible');
    expect(s.lines.join('\n')).toContain('name not printed');
  });

  it('set with scents lists them under the set', () => {
    const r: SetResult = { is_discovery_set: true, set_house: 'Le Labo', set_name: 'Discovery', status: { set_name: 'clear' }, scents: [perfume({ house: null, name: 'Santal 33' })] };
    expect(summarise('set', r).lines).toEqual(['Le Labo · Discovery', 'Santal 33']);
  });

  it('is_discovery_set false is not recognised', () => {
    const r: SetResult = { is_discovery_set: false, set_house: null, set_name: null, status: { set_name: 'absent' }, scents: [] };
    expect(summarise('set', r).recognised).toBe(false);
  });

  it('samples with flag true and zero vials is recognised', () => {
    const r: SamplesResult = { is_perfume_photo: true, vials: [], unreadable_count: 3 };
    const s = summarise('samples', r);
    expect(s.recognised).toBe(true);
    expect(s.lines[0]).toBe('No vial labels readable (3 unreadable)');
  });

  it('one vial is singular', () => {
    expect(summarise('samples', { is_perfume_photo: true, vials: [perfume()], unreadable_count: 0 }).lines[0]).toBe('1 vial read');
  });

  it('samples with flag false is not recognised', () => {
    expect(summarise('samples', { is_perfume_photo: false, vials: [], unreadable_count: 0 }).recognised).toBe(false);
  });

  it('bottle identified from shape notes branding and marks unclear fields', () => {
    const s = summarise('bottle', bottle(perfume({ status: { house: 'unclear', name: 'clear', concentration: 'absent' }, identified_from: 'shape' })));
    expect(s.recognised).toBe(true);
    expect(s.lines[0]).toBe('Xerjoff? · Naxos (from branding)');
  });

  it('bottle with alternatives adds an "or:" line', () => {
    const s = summarise('bottle', bottle(perfume({ house: 'Sospiro', name: 'Contessa', status: { house: 'clear', name: 'unclear', concentration: 'absent' }, alternatives: ['Console', 'Corallo'] })));
    expect(s.lines).toEqual(['Sospiro · Contessa?', 'or: Console, Corallo']);
  });

  it('bottle not perfume is not recognised', () => {
    expect(summarise('bottle', bottle(perfume(), false)).recognised).toBe(false);
  });
});
