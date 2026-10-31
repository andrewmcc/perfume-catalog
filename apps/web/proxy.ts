import { NextResponse, type NextRequest } from 'next/server';
import { SPIKE_COOKIE, checkSpikeAccess } from './lib/spike/access';
import { isPublicPath, loginRedirect } from './lib/auth/paths';
import { createProxyClient } from './lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Spike routes keep their own passcode gate.
  if (pathname === '/spike' || pathname.startsWith('/spike/') || pathname.startsWith('/api/spike/')) {
    if (pathname === '/spike/unlock' || pathname === '/spike/unlock/submit') return NextResponse.next();
    const access = await checkSpikeAccess({
      cookie: request.cookies.get(SPIKE_COOKIE)?.value,
      secret: process.env.SPIKE_PASSCODE ?? '',
    });
    if (access === 'allow') return NextResponse.next();
    if (pathname.startsWith('/api/')) return new NextResponse('Unauthorized', { status: 401 });
    return NextResponse.redirect(new URL('/spike/unlock', request.url));
  }

  const { supabase, getResponse } = createProxyClient(request);
  // Refresh the session before any redirect; read the response only afterwards.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const response = getResponse();

  if (user || isPublicPath(pathname)) return response;

  if (pathname.startsWith('/api/')) return new NextResponse('Unauthorized', { status: 401 });
  const redirect = NextResponse.redirect(new URL(loginRedirect(pathname, search), request.url));
  for (const { name, value, ...options } of response.cookies.getAll()) redirect.cookies.set(name, value, options);
  return redirect;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
};
