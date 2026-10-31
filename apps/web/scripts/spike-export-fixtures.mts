// Exports spike captures that have an extraction.json into packages/core/test/fixtures.
// Run: pnpm --filter @perfume/web exec tsx --env-file=.env.local scripts/spike-export-fixtures.mts
import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripStatus } from '../lib/spike/strip-status';

const BUCKET = 'perfume-spike-captures';
const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/core/test/fixtures');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);

async function download(p: string): Promise<Buffer | null> {
  const { data, error } = await storage.download(p);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

const counts: Record<string, number> = { bottle: 0, samples: 0, set: 0 };
let total = 0;
for (let offset = 0; ; offset += 100) {
  const { data: folders, error } = await storage.list('', { limit: 100, offset });
  if (error) throw error;
  if (!folders?.length) break;
  for (const folder of folders) {
    const id = folder.name;
    const extraction = await download(`${id}/extraction.json`);
    const meta = await download(`${id}/meta.json`);
    if (!extraction || !meta) continue;
    const draft = JSON.parse(extraction.toString());
    const mode: string = draft.mode ?? JSON.parse(meta.toString()).mode;
    const dir = path.join(FIXTURES, mode, id);
    await mkdir(dir, { recursive: true });
    for (const n of [1, 2]) {
      const photo = await download(`${id}/photo-${n}.jpg`);
      if (photo) await writeFile(path.join(dir, `photo-${n}.jpg`), photo);
    }
    await writeFile(path.join(dir, 'draft.json'), JSON.stringify(draft, null, 2) + '\n');
    const expectedPath = path.join(dir, 'expected.json');
    if (!existsSync(expectedPath)) {
      await writeFile(expectedPath, JSON.stringify(stripStatus(draft.result), null, 2) + '\n');
    }
    counts[mode] = (counts[mode] ?? 0) + 1;
    total++;
  }
  if (folders.length < 100) break;
}
console.log(`exported ${total} captures (${counts.bottle} bottle, ${counts.samples} samples, ${counts.set} set)`);
