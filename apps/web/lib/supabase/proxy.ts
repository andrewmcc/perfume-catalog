import { createServerClient } from '@perfume/supabase';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Supabase client for proxy.ts that threads cookies through the request/response.
 * A session refresh inside auth calls replaces the response, so read it via
 * getResponse() only after calling supabase.auth.getClaims().
 */
export function createProxyClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient({
    getAll() {
      return request.cookies.getAll();
    },
    setAll(cookiesToSet) {
      for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
    },
  });

  return { supabase, getResponse: () => response };
}
