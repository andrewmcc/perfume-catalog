import { createServerClient as createTypedServerClient } from '@perfume/supabase';
import { cookies } from 'next/headers';

/** Supabase client for Server Components and route handlers, scoped to the signed-in user. */
export async function createServerClient() {
  const cookieStore = await cookies();
  return createTypedServerClient({
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      try {
        for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
      } catch {
        // Called from a Server Component: the proxy refreshes the session instead.
      }
    },
  });
}
