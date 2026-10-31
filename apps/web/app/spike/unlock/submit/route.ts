import { SPIKE_COOKIE, spikeSessionToken, verifyPasscode } from '@/lib/spike/access';

export async function POST(request: Request) {
  const secret = process.env.SPIKE_PASSCODE ?? '';
  const form = await request.formData();
  const passcode = String(form.get('passcode') ?? '');

  if (!verifyPasscode(passcode, secret)) {
    return Response.redirect(new URL('/spike/unlock?error=1', request.url), 303);
  }

  const headers = new Headers({ Location: new URL('/spike/capture', request.url).toString() });
  headers.append(
    'Set-Cookie',
    `${SPIKE_COOKIE}=${await spikeSessionToken(secret)}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`,
  );
  return new Response(null, { status: 303, headers });
}
