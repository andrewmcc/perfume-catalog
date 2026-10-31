// Passcode gate for the throwaway spike. /spike/unlock POSTs the passcode; on a
// match the cookie gets an HMAC-derived session token (never the passcode itself).

export const SPIKE_COOKIE = 'spike_access';

export type SpikeAccess = 'allow' | 'deny';

function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function spikeSessionToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret || 'unset'), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('perfume-spike-session'));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function verifyPasscode(input: string, secret: string): boolean {
  if (!secret) return false;
  return constantTimeEqual(input, secret);
}

export async function checkSpikeAccess(input: { cookie?: string; secret: string }): Promise<SpikeAccess> {
  if (!input.secret || !input.cookie) return 'deny';
  return constantTimeEqual(input.cookie, await spikeSessionToken(input.secret)) ? 'allow' : 'deny';
}
