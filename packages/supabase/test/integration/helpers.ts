import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/database.types';
import { createServiceClient } from '../../src/client';

export type Client = SupabaseClient<Database>;

export const hasCredentials = Boolean(
  process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

if (!hasCredentials) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY unset (apps/web/.env.local): skipping integration suite.');
}

let _admin: Client | undefined;
/** Service-role client (bypasses RLS). */
export const admin = (): Client => (_admin ??= createServiceClient());

export function anonClient(): Client {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Creates a confirmed throwaway user and returns a client signed in as them. */
export async function createTestUser(): Promise<{ id: string; client: Client }> {
  const email = `rls-test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

export async function deleteTestUser(id: string): Promise<void> {
  await admin().auth.admin.deleteUser(id);
}

/** Creates a collection; the first member is the owner, the rest are members. */
export async function createTestCollection(memberIds: string[]): Promise<string> {
  const { data, error } = await admin().from('collections').insert({ name: `zz-test-${crypto.randomUUID()}` }).select('id').single();
  if (error) throw error;
  if (memberIds.length) {
    const { error: mErr } = await admin()
      .from('collection_members')
      .insert(memberIds.map((user_id, i) => ({ collection_id: data.id, user_id, role: i === 0 ? 'owner' : 'member' })));
    if (mErr) throw mErr;
  }
  return data.id;
}

/** Deletes a collection; its sets/items/photos/scans/perfumes/members cascade. */
export async function deleteTestCollection(id: string): Promise<void> {
  await admin().from('collections').delete().eq('id', id);
}

/** Recursively removes every object under a prefix in the photos bucket. */
export async function removeStoragePrefix(prefix: string): Promise<void> {
  const storage = admin().storage.from('photos');
  const { data } = await storage.list(prefix);
  const files: string[] = [];
  for (const e of data ?? []) {
    // Folders have no id; files do.
    if (e.id) files.push(`${prefix}/${e.name}`);
    else await removeStoragePrefix(`${prefix}/${e.name}`);
  }
  if (files.length) await storage.remove(files);
}
