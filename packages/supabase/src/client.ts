import { createBrowserClient as _createBrowserClient, createServerClient as _createServerClient } from '@supabase/ssr';
import type { CookieMethodsServer } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';

/**
 * Browser client for client components. Session lives in cookies managed by @supabase/ssr.
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function createBrowserClient() {
  return _createBrowserClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
  );
}

/**
 * Server client for Server Components, route handlers and the proxy. Pass the
 * request/response cookie adapter so session refreshes are written back.
 */
export function createServerClient(cookieStore: CookieMethodsServer) {
  return _createServerClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    { cookies: cookieStore },
  );
}

/**
 * Service-role client: bypasses RLS. Server-side only, never in client bundles.
 */
export function createServiceClient() {
  const url = process.env['SUPABASE_URL'] || process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  if (!url) throw new Error('SUPABASE_URL is required');
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
