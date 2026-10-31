import { describe, expect, it } from 'vitest';
import { summarise } from '../summarise';
import type { BottleResult, PerfumeRead, SamplesResult, SetResult } from '../extract-schema';

const perfume = (over: Partial<PerfumeRead> = {}): PerfumeRead => ({
  house: 'Xerjoff',
  name: 'Naxos',
  concentration: '',
  flanker_or_edition: '',
  size_ml: 0,
  status: { house: 'clear', name: 'clear', concentration: 'absent' },
  ...over,
});

describe('summarise', () => {
  it('set with empty scents is recognised and asks for the scent list', () => {
    const r: SetResult = {
      is_discovery_set: true,
      set_house: 'Matiere Premiere',
      set_name: '',
      status: { set_name: 'absent' },
      scents: [],
    };
    const s = summarise('set', r);
    expect(s.recognised).toBe(true);
    expect(s.lines.join('\n')).toContain('no scent list visible');
    expect(s.lines.join('\n')).toContain('name not printed');
  });

  it('is_discovery_set false is not recognised', () => {
    const r: SetResult = { is_discovery_set: false, set_house: '', set_name: '', status: { set_name: 'absent' }, scents: [] };
    expect(summarise('set', r).recognised).toBe(false);
  });

  it('samples with flag true and zero vials is recognised', () => {
    const r: SamplesResult = { is_perfume_photo: true, vials: [], unreadable_count: 3 };
    const s = summarise('samples', r);
    expect(s.recognised).toBe(true);
    expect(s.lines[0]).toBe('No vial labels readable (3 unreadable)');
  });

  it('samples with flag false is not recognised', () => {
    const r: SamplesResult = { is_perfume_photo: false, vials: [], unreadable_count: 0 };
    expect(summarise('samples', r).recognised).toBe(false);
  });

  it('bottle identified from shape notes branding and marks unclear fields', () => {
    const r: BottleResult = {
      is_perfume: true,
      perfume: perfume({ status: { house: 'unclear', name: 'clear', concentration: 'absent' } }),
      format: 'full',
      batch_code: '',
      identified_from: 'shape',
      other_text: '',
    };
    const s = summarise('bottle', r);
    expect(s.recognised).toBe(true);
    expect(s.lines[0]).toContain('(from branding)');
    expect(s.lines[0]).toContain('Xerjoff? · Naxos');
  });
});
