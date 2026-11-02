import { describe, expect, it } from 'vitest';
import { confirmDestination, isSameOrigin, parseConfirmParams } from '../confirm';

const p = (q: string) => parseConfirmParams(new URLSearchParams(q));
const T = 'abcdef123456';

describe('parseConfirmParams', () => {
  it('accepts recovery and invite and pins the destination to /reset-password', () => {
    for (const type of ['recovery', 'invite']) {
      expect(p(`token_hash=${T}&type=${type}&next=/reset-password`)).toEqual({ ok: true, type, tokenHash: T, next: '/reset-password' });
      expect(p(`token_hash=${T}&type=${type}&next=//evil.com`)).toMatchObject({ next: '/reset-password' });
      expect(p(`token_hash=${T}&type=${type}&next=/collection`)).toMatchObject({ next: '/reset-password' });
    }
  });
  it('accepts email and honours a safe next', () => {
    expect(p(`token_hash=${T}&type=email&next=/collection`)).toMatchObject({ ok: true, type: 'email', next: '/collection' });
    expect(p(`token_hash=${T}&type=email&next=//evil.com`)).toMatchObject({ next: '/today' });
  });
  it('rejects other types and missing type', () => {
    for (const t of ['signup', 'magiclink', 'email_change']) expect(p(`token_hash=${T}&type=${t}`)).toEqual({ ok: false });
    expect(p(`token_hash=${T}`)).toEqual({ ok: false });
  });
  it('rejects a missing or malformed token', () => {
    expect(p('type=recovery')).toEqual({ ok: false });
    expect(p('token_hash=&type=recovery')).toEqual({ ok: false });
    expect(p('token_hash="><script>&type=recovery')).toEqual({ ok: false });
  });
});

describe('confirmDestination', () => {
  it('pins recovery and invite', () => {
    expect(confirmDestination('recovery', '/x')).toBe('/reset-password');
    expect(confirmDestination('invite', '/x')).toBe('/reset-password');
  });
});

describe('isSameOrigin', () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it('accepts the request origin or the app url', () => {
    expect(isSameOrigin(h({ origin: 'http://a.test' }), 'http://a.test', undefined)).toBe(true);
    expect(isSameOrigin(h({ origin: 'https://app.test' }), 'http://internal', 'https://app.test')).toBe(true);
    expect(isSameOrigin(h({ referer: 'https://app.test/auth/confirm?x=1' }), 'http://internal', 'https://app.test')).toBe(true);
  });
  it('fails closed on a malformed app url', () => {
    expect(isSameOrigin(h({ origin: 'http://a.test' }), 'http://a.test', 'not a url')).toBe(false);
    expect(isSameOrigin(h({ origin: 'https://evil.test' }), 'http://a.test', 'not a url')).toBe(false);
  });
  it('rejects foreign, null and missing origins', () => {
    expect(isSameOrigin(h({ origin: 'https://evil.test' }), 'http://a.test', 'https://app.test')).toBe(false);
    expect(isSameOrigin(h({ origin: 'null' }), 'http://a.test', undefined)).toBe(false);
    expect(isSameOrigin(h({}), 'http://a.test', undefined)).toBe(false);
  });
});
