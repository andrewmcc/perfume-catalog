// Exports read scans (extracted or discarded) into packages/core/test/fixtures as eval fixtures.
// expected.json starts as the model's output without statuses: correct it by hand before trusting the eval.
// Run: pnpm --filter @perfume/web exec tsx --conditions=react-server --env-file=.env.local scripts/export-fixtures.mts
import { createServiceClient } from '@perfume/supabase';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripStatus } from '../lib/fixtures/strip-status';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages/core/test/fixtures');
const db = createServiceClient();

const counts: Record<string, number> = { bottle: 0, samples: 0, set: 0 };
let total = 0;
for (let offset = 0; ; offset += 100) {
  const { data: scans, error } = await db
    .from('scans')
    .select('id, mode, photo_paths, extraction')
    .in('status', ['extracted', 'discarded', 'reviewed'])
    .not('extraction', 'is', null)
    .order('created_at')
    .range(offset, offset + 99);
  if (error) throw error;
  if (!scans.length) break;
  for (const scan of scans) {
    const dir = path.join(FIXTURES, scan.mode, scan.id);
    await mkdir(dir, { recursive: true });
    for (const [i, p] of scan.photo_paths.entries()) {
      const { data } = await db.storage.from('photos').download(p);
      if (data) await writeFile(path.join(dir, `photo-${i + 1}.jpg`), Buffer.from(await data.arrayBuffer()));
    }
    await writeFile(path.join(dir, 'draft.json'), JSON.stringify(scan.extraction, null, 2) + '\n');
    const expectedPath = path.join(dir, 'expected.json');
    if (!existsSync(expectedPath)) await writeFile(expectedPath, JSON.stringify(stripStatus(scan.extraction), null, 2) + '\n');
    counts[scan.mode] = (counts[scan.mode] ?? 0) + 1;
    total++;
  }
  if (scans.length < 100) break;
}
console.log(`exported ${total} scans (${counts.bottle} bottle, ${counts.samples} samples, ${counts.set} set)`);
