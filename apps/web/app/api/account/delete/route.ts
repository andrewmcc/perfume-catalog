import { createServiceClient } from '@perfume/supabase';
import { deleteAccount } from '@/lib/account/delete';
import { createServerClient } from '@/lib/supabase/server';

export const maxDuration = 60;

/** Deletes the signed-in member's account (body must be { confirm: 'delete' }), then signs them out. */
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== 'delete') return Response.json({ error: 'Type delete to confirm.' }, { status: 400 });

  try {
    await deleteAccount(createServiceClient(), userId);
  } catch (e) {
    console.error('delete account', e instanceof Error ? e.message : String(e));
    return Response.json({ error: 'Couldn’t delete your account. Nothing was signed out; try again.' }, { status: 500 });
  }
  await supabase.auth.signOut().catch(() => {});
  return Response.json({ ok: true });
}
