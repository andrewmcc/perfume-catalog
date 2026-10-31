import { NextResponse, type NextRequest } from 'next/server';
import { SPIKE_COOKIE, checkSpikeAccess } from './lib/spike/access';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/spike/unlock' || pathname === '/spike/unlock/submit') return NextResponse.next();
  const access = await checkSpikeAccess({
    cookie: request.cookies.get(SPIKE_COOKIE)?.value,
    secret: process.env.SPIKE_PASSCODE ?? '',
  });
  if (access === 'allow') return NextResponse.next();
  if (pathname.startsWith('/api/')) return new NextResponse('Unauthorized', { status: 401 });
  return NextResponse.redirect(new URL('/spike/unlock', request.url));
}

export const config = {
  matcher: ['/spike/:path*', '/api/spike/:path*'],
};
