import { NextResponse, type NextRequest } from 'next/server';
import { callbackDestination, callbackFailureRedirect } from '@/lib/auth/callback';
import { createServerClient } from '@/lib/supabase/server';

/** PKCE callback: exchange the code for a session, then go where the user was heading. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectTo = callbackDestination(searchParams);

  // Prefer the configured app URL so links still land on the right host if Supabase's Site URL is off.
  const base = process.env.NEXT_PUBLIC_APP_URL ?? origin;

  if (!code) return NextResponse.redirect(`${base}${callbackFailureRedirect(searchParams)}`);
  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('auth callback: code exchange failed', error.message);
    return NextResponse.redirect(`${base}${callbackFailureRedirect(searchParams)}`);
  }

  return NextResponse.redirect(`${base}${redirectTo}`);
}
