import { NextResponse, type NextRequest } from 'next/server';
import { isSameOrigin, parseConfirmParams } from '@/lib/auth/confirm';
import { createServerClient } from '@/lib/supabase/server';

const baseUrl = (origin: string) => process.env.NEXT_PUBLIC_APP_URL ?? origin;
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PAGE = (hidden: string, label: string) => `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Continue · Perfume Catalog</title>
<style>
:root{color-scheme:light dark;--paper:#eee3cc;--ink:#2e241a;--muted:#6a5a44;--leaf:#3e5b36;--leaf-ink:#f6eedc}
@media(prefers-color-scheme:dark){:root{--paper:#1d1914;--ink:#ede3cf;--muted:#b3a387;--leaf:#93b27f;--leaf-ink:#1d1914}}
body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,sans-serif}
main{max-width:24rem;margin:0 auto;padding:max(15vh,env(safe-area-inset-top)) 1.5rem 2.5rem;display:flex;flex-direction:column;gap:1rem}
.brand{font:400 2rem/1 Georgia,serif;margin:0}h1{font:400 1.5rem/1.2 Georgia,serif;margin:1rem 0 0}
p{color:var(--muted);font-size:17px;line-height:1.5;margin:0}
button{min-height:44px;border:0;border-radius:6px;background:var(--leaf);color:var(--leaf-ink);font-size:15px;font-weight:500;width:100%}
</style></head><body><main>
<p class="brand">Perfume Catalog</p><h1>Continue</h1>
<p>${label}</p>
<form method="post" action="/auth/confirm">${hidden}<button type="submit">Continue</button></form>
</main></body></html>`;

/**
 * GET only shows a confirmation page and verifies nothing: mail scanners that prefetch the link
 * must not burn the one-time token, and a crafted link must not sign anyone in by merely being opened.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const parsed = parseConfirmParams(searchParams);
  if (!parsed.ok) return NextResponse.redirect(`${baseUrl(origin)}/login?error=reset`);
  const hidden = [
    ['token_hash', parsed.tokenHash],
    ['type', parsed.type],
    ['next', searchParams.get('next') ?? ''],
  ]
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v!)}">`)
    .join('');
  return new Response(PAGE(hidden, parsed.type === 'email' ? 'Continue to confirm your email' : 'Continue to set your password'), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}

/** Verifies the token (same-origin form posts only) and redirects with 303. */
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  if (!isSameOrigin(request.headers, origin, process.env.NEXT_PUBLIC_APP_URL)) {
    return new Response('Forbidden', { status: 403 });
  }
  const form = await request.formData().catch(() => null);
  const params = new URLSearchParams();
  for (const k of ['token_hash', 'type', 'next']) {
    const v = form?.get(k);
    if (typeof v === 'string') params.set(k, v);
  }
  const parsed = parseConfirmParams(params);
  const fail = NextResponse.redirect(`${baseUrl(origin)}/login?error=reset`, 303);
  if (!parsed.ok) return fail;

  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({ type: parsed.type, token_hash: parsed.tokenHash });
  if (error) {
    console.error('auth confirm: verifyOtp failed', error.message);
    return fail;
  }
  return NextResponse.redirect(`${baseUrl(origin)}${parsed.next}`, 303);
}
