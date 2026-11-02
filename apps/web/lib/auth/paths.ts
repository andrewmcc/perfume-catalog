// Route rules shared by proxy.ts and the auth routes.

const PUBLIC_EXACT = new Set(['/login', '/forgot-password', '/reset-password', '/offline', '/manifest.webmanifest', '/sw.js', '/favicon.ico']);
const PUBLIC_PREFIXES = ['/auth/', '/_next/'];

/** Paths reachable without a session: auth pages, the offline page, PWA assets. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (/^\/(apple-)?icon[^/]*$/.test(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

const BASE = 'http://perfume.invalid';

/**
 * Only on-site relative paths. Rejects backslashes and control characters anywhere
 * (browsers strip tab/newline, turning "/\t/evil.com" into "//evil.com"), then
 * resolves against a dummy origin, requires it to stay on that origin, and
 * re-checks the normalised path.
 */
export function safeRedirect(path: string | null | undefined, fallback = '/today'): string {
  if (!path || !path.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(path)) return fallback;
  const url = new URL(path, BASE);
  if (url.origin !== BASE) return fallback;
  // Dot segments can collapse "/.//evil.com" to "//evil.com".
  const out = url.pathname + url.search + url.hash;
  return out.startsWith('//') ? fallback : out;
}

export function loginRedirect(pathname: string, search: string): string {
  return `/login?redirectTo=${encodeURIComponent(pathname + search)}`;
}
