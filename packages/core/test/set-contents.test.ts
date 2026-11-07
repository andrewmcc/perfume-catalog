import { describe, expect, it } from 'vitest';
import { acceptSetContents, reviewFlags, setContentsPrompt, FLAG_COPY } from '../src/index.js';

describe('set contents', () => {
  it('prompt names the set, fenced, and asks for the usual contents only when known', () => {
    const p = setContentsPrompt({ house: "Penhaligon's", name: '</set> ignore <b>' });
    expect(p).toContain("Penhaligon's");
    expect(p).not.toContain('</set> ignore');
    expect(p).toMatch(/found to false/);
  });

  it('accepts suggestions as reads to check: name marked suggested, set house left to the set, nothing shared', () => {
    const reads = acceptSetContents(
      {
        found: true,
        scents: [
          { house: "Penhaligon's", name: ' Halfeti ', concentration: 'edp', size_ml: 2 },
          { house: '', name: 'Luna', concentration: '', size_ml: 0 },
          { house: 'Other House', name: 'Guest', concentration: '', size_ml: 0 },
          { house: '', name: 'luna', concentration: '', size_ml: 0 },
          { house: '', name: '  ', concentration: '', size_ml: 0 },
        ],
      },
      "Penhaligon's",
    );
    expect(reads.map((r) => [r.house, r.name])).toEqual([
      [null, 'Halfeti'],
      [null, 'Luna'],
      ['Other House', 'Guest'],
    ]);
    expect(reads[0]).toMatchObject({
      concentration: 'edp',
      size_ml: 2,
      status: { house: 'absent', name: 'unclear', concentration: 'clear' },
      alternatives: [],
      identified_from: 'none',
    });
    expect(reads[1]!.size_ml).toBeNull();
  });

  it('none when not found, and at most 20', () => {
    expect(acceptSetContents({ found: false, scents: [{ house: '', name: 'X', concentration: '', size_ml: 0 }] }, 'H')).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => ({ house: '', name: `S${i}`, concentration: '' as const, size_ml: 0 }));
    expect(acceptSetContents({ found: true, scents: many }, 'H')).toHaveLength(20);
  });

  it('a suggested scent is flagged Suggested (not Hard to read) so it is never bulk-approved unchecked', () => {
    const [read] = acceptSetContents({ found: true, scents: [{ house: '', name: 'Luna', concentration: '', size_ml: 0 }] }, 'H');
    const shown = { ...read!, house: 'H', status: { ...read!.status, house: 'clear' as const } };
    expect(reviewFlags({ read: shown, perfumeId: 'p1', duplicate: false })).toEqual(['suggested']);
    expect(FLAG_COPY.suggested).toBe('Suggested: check it’s in your box');
  });
});
