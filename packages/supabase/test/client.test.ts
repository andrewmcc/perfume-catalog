import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServiceClient } from '../src/client';

afterEach(() => vi.unstubAllEnvs());

describe('createServiceClient', () => {
  it('throws without a service role key', () => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => createServiceClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY is required');
  });
});
