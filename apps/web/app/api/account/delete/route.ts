import { createServiceClient } from '@perfume/supabase';
import { deleteAccount } from '@/lib/account/delete';
import { isSameOrigin } from '@/lib/auth/confirm';
import { createServerClient } from '@/lib/supabase/server';

export const maxDuration = 60;

/** Deletes the signed-in member's account (body must be { confirm: 'delete' }), then signs them out. */
export async function POST(request: Request) {
  // Irreversible: same-origin JSON only, on top of SameSite=Lax session cookies.
  if (!isSameOrigin(request.headers, new URL(request.url).origin, process.env.NEXT_PUBLIC_APP_URL) || !request.headers.get('content-type')?.startsWith('application/json')) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }
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
    return Response.json({ error: 'Couldn’t finish deleting your account. Try again.' }, { status: 500 });
  }
  await supabase.auth.signOut().catch(() => {});
  return Response.json({ ok: true });
}
