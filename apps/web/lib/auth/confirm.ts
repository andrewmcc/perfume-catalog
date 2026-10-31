import { safeRedirect } from './paths';

// Token-hash links: password recovery, invites, and plain email confirmation.
export type ConfirmType = 'recovery' | 'invite' | 'email';
const TYPES: readonly string[] = ['recovery', 'invite', 'email'];
// Supabase token hashes are url-safe alphanumerics; reject anything else before it reaches HTML or verifyOtp.
const TOKEN = /^[A-Za-z0-9_-]{6,256}$/;

/** Recovery and invite always land on the password form, so a crafted `next` can't send a fresh session elsewhere. */
export function confirmDestination(type: ConfirmType, next?: string | null): string {
  return type === 'email' ? safeRedirect(next) : '/reset-password';
}

/** Validates the type, token and next of an /auth/confirm request (query on GET, form on POST). */
export function parseConfirmParams(
  params: URLSearchParams,
): { ok: true; type: ConfirmType; tokenHash: string; next: string } | { ok: false } {
  const type = params.get('type');
  const tokenHash = params.get('token_hash');
  if (!tokenHash || !TOKEN.test(tokenHash) || !type || !TYPES.includes(type)) return { ok: false };
  return { ok: true, type: type as ConfirmType, tokenHash, next: confirmDestination(type as ConfirmType, params.get('next')) };
}

/** True when the request's Origin (or Referer) is the app's own origin. Missing both counts as foreign. */
export function isSameOrigin(headers: Headers, requestOrigin: string, appUrl: string | undefined): boolean {
  const claimed = headers.get('origin') ?? headers.get('referer');
  if (!claimed) return false;
  let origin: string;
  try {
    origin = new URL(claimed).origin;
  } catch {
    return false;
  }
  const allowed = new Set([requestOrigin]);
  if (appUrl) allowed.add(new URL(appUrl).origin);
  return allowed.has(origin);
}
