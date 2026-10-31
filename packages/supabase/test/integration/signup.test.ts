import { describe, expect, it } from 'vitest';
import { admin, anonClient, hasCredentials } from './helpers';

describe.skipIf(!hasCredentials)('public sign-up is disabled', () => {
  it('anon signUp is rejected', async () => {
    const email = `zz-signup-${crypto.randomUUID()}@example.com`;
    const { data, error } = await anonClient().auth.signUp({ email, password: crypto.randomUUID() });
    if (data.user) await admin().auth.admin.deleteUser(data.user.id);
    expect(error?.code).toBe('signup_disabled');
    expect(data.user).toBeNull();
  });
});
