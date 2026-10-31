import { describe, expect, it } from 'vitest';
import { isPublicPath, loginRedirect, safeRedirect } from '../paths';

describe('safeRedirect', () => {
  it.each([
    ['/collection', '/collection'],
    ['/collection?q=x', '/collection?q=x'],
    ['//evil.com', '/today'],
    ['/\\evil.com', '/today'],
    ['https://evil.com', '/today'],
    ['', '/today'],
    [null, '/today'],
    [undefined, '/today'],
    ['/\t/evil.com', '/today'],
    ['/\n/evil.com', '/today'],
    ['/a\\x', '/today'],
    ['/review#top', '/review#top'],
    ['/.//evil.com', '/today'],
    ['/..//evil.com', '/today'],
    ['/a/..//evil.com', '/today'],
  ])('%s -> %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });

  it('uses the given fallback', () => {
    expect(safeRedirect('//evil.com', '/collection')).toBe('/collection');
  });
});

describe('isPublicPath', () => {
  it.each([
    '/login',
    '/forgot-password',
    '/reset-password',
    '/offline',
    '/auth/confirm',
    '/auth/callback',
    '/manifest.webmanifest',
    '/icon.png',
    '/apple-icon.png',
    '/favicon.ico',
    '/_next/static/x.js',
    '/spike/capture',
    '/api/spike/extract',
  ])('%s is public', (p) => expect(isPublicPath(p)).toBe(true));

  it.each(['/', '/today', '/collection', '/scan', '/review', '/api/scans', '/loginx', '/signup', '/authx'])('%s is protected', (p) =>
    expect(isPublicPath(p)).toBe(false),
  );
});

describe('loginRedirect', () => {
  it('encodes the deep link to return to after sign-in', () => {
    expect(loginRedirect('/review', '')).toBe('/login?redirectTo=%2Freview');
    expect(loginRedirect('/collection', '?q=tom')).toBe('/login?redirectTo=%2Fcollection%3Fq%3Dtom');
  });
});
