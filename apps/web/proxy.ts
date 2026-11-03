import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath, loginRedirect } from './lib/auth/paths';
import { createProxyClient } from './lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const { supabase, getResponse } = createProxyClient(request);
  // Refresh the session before any redirect; read the response only afterwards.
  // getClaims refreshes an expired session, then verifies the JWT locally (ES256 signing keys).
  const { data } = await supabase.auth.getClaims();
  const response = getResponse();

  if (data?.claims?.sub || isPublicPath(pathname)) return response;

  if (pathname.startsWith('/api/')) return new NextResponse('Unauthorized', { status: 401 });
  const redirect = NextResponse.redirect(new URL(loginRedirect(pathname, search), request.url));
  for (const { name, value, ...options } of response.cookies.getAll()) redirect.cookies.set(name, value, options);
  return redirect;
}

// Paths ending in image extensions skip the auth gate: never put protected route handlers at such paths.
export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
};
