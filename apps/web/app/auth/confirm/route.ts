import { NextResponse, type NextRequest } from 'next/server';
import { isSameOrigin, parseConfirmParams } from '@/lib/auth/confirm';
import { createServerClient } from '@/lib/supabase/server';

const baseUrl = (origin: string) => process.env.NEXT_PUBLIC_APP_URL ?? origin;
const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PAGE = (hidden: string, label: string) => `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Continue · Flacon</title>
<style>
:root{color-scheme:light;--paper:#f5eee0;--card:#fffaf0;--line:#d8c8a8;--rule:#e7d9bd;--ink:#3a1d1d;--muted:#7a5b47;--oxblood:#6e2a2a}
body{margin:0;background:var(--paper);color:var(--ink);font-family:Figtree,system-ui,sans-serif}
main{max-width:24rem;margin:0 auto;padding:max(15vh,env(safe-area-inset-top)) 1.5rem 2.5rem;display:flex;flex-direction:column;gap:1.5rem}
.brand{font:400 2.25rem/1 "Bodoni Moda","Bodoni 72",Didot,Georgia,serif;letter-spacing:.08em;color:var(--oxblood);text-align:center;margin:0}
.card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:4px;padding:1.75rem 1.5rem;display:flex;flex-direction:column;gap:1rem}
.card:before{content:"";position:absolute;inset:3px;border:1px solid var(--rule);border-radius:2px;pointer-events:none}
h1{font:italic 400 1.5rem/1.2 "Bodoni Moda","Bodoni 72",Didot,Georgia,serif;margin:0}
p{color:var(--muted);font-size:16px;line-height:1.5;margin:0}
button{min-height:44px;border:0;border-radius:4px;background:var(--oxblood);color:var(--paper);font-size:15px;font-weight:500;width:100%;box-shadow:inset 0 0 0 3px var(--oxblood),inset 0 0 0 4px rgba(232,196,106,.55)}
</style></head><body><main>
<p class="brand">Flacon</p>
<div class="card"><h1>Continue</h1>
<p>${label}</p>
<form method="post" action="/auth/confirm">${hidden}<button type="submit">Continue</button></form></div>
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
