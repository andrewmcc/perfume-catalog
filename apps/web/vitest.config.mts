import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
  },
  resolve: {
    alias: {
      '@': here('.'),
      'server-only': here('test/server-only-stub.ts'),
    },
  },
});
