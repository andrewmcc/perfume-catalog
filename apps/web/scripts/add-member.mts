import { createServiceClient } from '@perfume/supabase';
import { parseAddMemberArgs } from '../lib/auth/add-member-args';

const { email, collectionId, collectionName } = parseAddMemberArgs(process.argv.slice(2));
const db = createServiceClient();
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is required');

async function findUserId(target: string): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) return undefined;
  }
}

let userId = await findUserId(email);
if (!userId) {
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${appUrl}/auth/confirm` });
  if (error || !data.user) throw error ?? new Error('invite failed');
  userId = data.user.id;
}

let collection = collectionId;
let role: 'owner' | 'member' = 'member';
if (!collection) {
  const { data, error } = await db.from('collections').insert({ name: collectionName }).select('id').single();
  if (error) throw error;
  collection = data.id;
  role = 'owner';
}

const { error } = await db
  .from('collection_members')
  .upsert({ collection_id: collection, user_id: userId, role }, { onConflict: 'collection_id,user_id' });
if (error) throw error;
console.log(`member ${email} → collection ${collection}`);
