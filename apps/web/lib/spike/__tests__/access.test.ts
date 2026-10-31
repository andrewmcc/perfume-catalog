import { describe, expect, it } from 'vitest';
import { checkSpikeAccess, spikeSessionToken, verifyPasscode } from '../access';

const secret = 's3cret';

describe('spikeSessionToken', () => {
  it('is a stable 64-char hex HMAC that does not reveal the passcode', async () => {
    const a = await spikeSessionToken(secret);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(await spikeSessionToken(secret));
    expect(a).not.toContain(secret);
    expect(a).not.toBe(await spikeSessionToken('other'));
  });
});

describe('checkSpikeAccess', () => {
  it('allows the session token cookie', async () => {
    expect(await checkSpikeAccess({ cookie: await spikeSessionToken(secret), secret })).toBe('allow');
  });

  it('denies the raw passcode, a wrong cookie, or no cookie', async () => {
    expect(await checkSpikeAccess({ cookie: secret, secret })).toBe('deny');
    expect(await checkSpikeAccess({ cookie: 'nope', secret })).toBe('deny');
    expect(await checkSpikeAccess({ secret })).toBe('deny');
  });

  it('fails closed when the secret env var is empty', async () => {
    expect(await checkSpikeAccess({ cookie: await spikeSessionToken(''), secret: '' })).toBe('deny');
  });
});

describe('verifyPasscode', () => {
  it('accepts only the exact passcode', () => {
    expect(verifyPasscode(secret, secret)).toBe(true);
    expect(verifyPasscode('s3cre', secret)).toBe(false);
    expect(verifyPasscode('s3cret!', secret)).toBe(false);
    expect(verifyPasscode('', secret)).toBe(false);
  });

  it('rejects everything when the secret is empty', () => {
    expect(verifyPasscode('', '')).toBe(false);
  });
});
