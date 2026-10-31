import { readFileSync, existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Integration tests hit the hosted Supabase project; credentials come from apps/web/.env.local.
const envFile = new URL('../../apps/web/.env.local', import.meta.url);
const env: Record<string, string> = {};
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
}

export default defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    env,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
