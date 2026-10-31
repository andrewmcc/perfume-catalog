// Creates the private `perfume-spike-captures` bucket used by the Phase 0 spike.
// Run: pnpm --filter @perfume/web exec tsx --env-file=.env.local scripts/spike-setup.mts
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'perfume-spike-captures';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: existing } = await supabase.storage.getBucket(BUCKET);
if (!existing) {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (error) throw error;
}
console.log(`bucket ${BUCKET} ready`);
