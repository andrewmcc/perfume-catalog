// Runs real extraction over test/fixtures/<mode>/<id>/ and prints per-field agreement with expected.json.
// The fixtures are UNVERIFIED model output (except the Naxos house), so this is a regression signal, not accuracy.
import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractWithClaude, normalizeResult, type Mode } from '../src/index.js';

const root = fileURLToPath(new URL('../test/fixtures/', import.meta.url));
const client = new Anthropic();
const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : v ?? '');
const eq = (a: unknown, b: unknown) => norm(a) === norm(b) || ((a === null || a === '') && (b === null || b === ''));

type Tally = Record<string, { agree: number; total: number }>;
const tally: Record<string, Tally> = {};
const bump = (mode: string, field: string, ok: boolean) => {
  const t = ((tally[mode] ??= {})[field] ??= { agree: 0, total: 0 });
  t.total++;
  if (ok) t.agree++;
};
let withAlternatives = 0;
let bottles = 0;
const timings: number[] = [];

for (const mode of ['bottle', 'samples', 'set'] as Mode[]) {
  const dir = join(root, mode);
  if (!existsSync(dir)) continue;
  for (const id of readdirSync(dir)) {
    const base = join(dir, id);
    const photos = ['photo-1.jpg', 'photo-2.jpg'].filter((f) => existsSync(join(base, f))).map((f) => readFileSync(join(base, f)).toString('base64'));
    const expected = JSON.parse(readFileSync(join(base, 'expected.json'), 'utf8'));
    const t0 = Date.now();
    let got: any;
    try {
      got = normalizeResult(mode, await extractWithClaude(client, mode, photos));
    } catch (e) {
      console.log(`${mode}/${id.slice(0, 8)} ERROR ${(e as Error).message}`);
      bump(mode, 'no_error', false);
      continue;
    }
    timings.push(Date.now() - t0);
    bump(mode, 'no_error', true);
    if (mode === 'bottle') {
      bottles++;
      if (got.perfume.alternatives.length) withAlternatives++;
      bump(mode, 'is_perfume', got.is_perfume === expected.is_perfume);
      if (expected.is_perfume) {
        for (const f of ['house', 'name', 'concentration']) bump(mode, f, eq(got.perfume[f], expected.perfume[f]));
        bump(mode, 'format', got.format === expected.format);
      }
      console.log(`bottle/${id.slice(0, 8)} ${got.perfume.house ?? '-'} · ${got.perfume.name ?? '-'} [${got.perfume.status.name}] alts=${JSON.stringify(got.perfume.alternatives)}`);
    } else if (mode === 'samples') {
      bump(mode, 'is_perfume_photo', got.is_perfume_photo === expected.is_perfume_photo);
      bump(mode, 'vial_count', got.vials.length === expected.vials.length);
    } else {
      bump(mode, 'is_discovery_set', got.is_discovery_set === expected.is_discovery_set);
      if (expected.is_discovery_set) {
        bump(mode, 'set_house', eq(got.set_house, expected.set_house));
        bump(mode, 'set_name', eq(got.set_name, expected.set_name));
        bump(mode, 'scent_count', got.scents.length === expected.scents.length);
      }
      console.log(`set/${id.slice(0, 8)} ${got.set_house ?? '-'} · ${got.set_name ?? '-'} scents=${got.scents.length}`);
    }
  }
}

console.log('\nAgreement with expected.json (unverified fixtures):');
for (const [mode, fields] of Object.entries(tally)) {
  console.log(`  ${mode}: ${Object.entries(fields).map(([f, t]) => `${f} ${t.agree}/${t.total}`).join(', ')}`);
}
console.log(`  bottles with non-empty alternatives: ${withAlternatives}/${bottles}`);
if (timings.length) {
  const s = [...timings].sort((a, b) => a - b);
  console.log(`  time per scan: median ${(s[Math.floor(s.length / 2)]! / 1000).toFixed(1)}s, max ${(s.at(-1)! / 1000).toFixed(1)}s`);
}
