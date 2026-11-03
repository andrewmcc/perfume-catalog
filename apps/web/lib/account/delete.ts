import 'server-only';
import type { createServiceClient } from '@perfume/supabase';

// Structural, so the service client and a plain supabase-js client both fit.
type Admin = Pick<ReturnType<typeof createServiceClient>, 'from' | 'storage' | 'auth'>;

/** Every object under a collection's folder (photos live at <collection>/<scan>/<file>). */
async function listUnder(db: Admin, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from('photos').list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const f of data) {
      const path = `${prefix}/${f.name}`;
      // Folders have no id; recurse into them.
      if (f.id) out.push(path);
      else out.push(...(await listUnder(db, path)));
    }
    if (data.length < 1000) return out;
  }
}

/**
 * Deletes a member's account (service role). Collections they were the last member of go too,
 * with everything in them (cascades) and their photos; a collection with another member stays.
 */
export async function deleteAccount(db: Admin, userId: string): Promise<{ deletedCollections: string[] }> {
  const { data: mine, error } = await db.from('collection_members').select('collection_id').eq('user_id', userId);
  if (error) throw error;
  const deletedCollections: string[] = [];
  for (const { collection_id: cid } of mine) {
    const { count, error: cErr } = await db.from('collection_members').select('user_id', { count: 'exact', head: true }).eq('collection_id', cid).neq('user_id', userId);
    if (cErr) throw cErr;
    if (count) continue;
    const paths = await listUnder(db, cid);
    for (let i = 0; i < paths.length; i += 100) {
      const { error: rErr } = await db.storage.from('photos').remove(paths.slice(i, i + 100));
      if (rErr) throw rErr;
    }
    const { error: dErr } = await db.from('collections').delete().eq('id', cid);
    if (dErr) throw dErr;
    deletedCollections.push(cid);
  }
  const { error: uErr } = await db.auth.admin.deleteUser(userId);
  if (uErr) throw uErr;
  return { deletedCollections };
}
