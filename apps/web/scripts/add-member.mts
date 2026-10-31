import { createServiceClient } from '@perfume/supabase';
import { parseAddMemberArgs } from '../lib/auth/add-member-args';

const { email, collectionId, collectionName, appUrl: appUrlArg } = parseAddMemberArgs(process.argv.slice(2));
const appUrl = (appUrlArg ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
if (!appUrl) throw new Error('--app-url or NEXT_PUBLIC_APP_URL is required');
const db = createServiceClient();

// Generate a one-time link for the operator to send; no email goes out (free SMTP allows 2/hour).
let linkType: 'invite' | 'recovery' = 'invite';
let { data: gen, error: genError } = await db.auth.admin.generateLink({
  type: 'invite',
  email,
  options: { redirectTo: `${appUrl}/auth/confirm` },
});
if (genError) {
  // Invite fails for an existing user; a recovery link reaches the same set-password page.
  linkType = 'recovery';
  ({ data: gen, error: genError } = await db.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${appUrl}/auth/confirm` },
  }));
}
if (genError || !gen?.user) throw genError ?? new Error('generateLink failed');
const userId = gen.user.id;
const link = `${appUrl}/auth/confirm?token_hash=${gen.properties.hashed_token}&type=${linkType}`;

let collection = collectionId;
let role: 'owner' | 'member' = 'member';
if (!collection) {
  const { data, error } = await db.from('collections').insert({ name: collectionName }).select('id').single();
  if (error) throw error;
  collection = data.id;
  role = 'owner';
}

// ignoreDuplicates keeps an existing role (never demote an owner).
const { error } = await db
  .from('collection_members')
  .upsert({ collection_id: collection, user_id: userId, role }, { onConflict: 'collection_id,user_id', ignoreDuplicates: true });
if (error) throw error;
const { data: row, error: roleError } = await db
  .from('collection_members')
  .select('role')
  .eq('collection_id', collection)
  .eq('user_id', userId)
  .single();
if (roleError) throw roleError;
console.log(`member ${email} → collection ${collection} (${row.role})`);
console.log(`link: ${link}`);
