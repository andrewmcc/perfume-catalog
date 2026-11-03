import { after } from 'next/server';
import { createServiceClient } from '@perfume/supabase';
import { addFromText, parseFromText } from '@/lib/perfumes/add-from-text';
import { enrichPerfume, rowHasNotes } from '@/lib/perfumes/enrich';
import { claimLookup } from '@/lib/perfumes/lookup';
import { getCurrentCollectionId } from '@/lib/collections/current';
import { createServerClient } from '@/lib/supabase/server';

export const maxDuration = 300;

/** Adds an owned or wishlist item from typed details; fills in a perfume without notes afterwards. */
export async function POST(request: Request) {
  const supabase = await createServerClient();
  const collectionId = await getCurrentCollectionId(supabase);
  if (!collectionId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const input = parseFromText(await request.json().catch(() => null));
  if (!input) return Response.json({ error: 'Check the house and name.' }, { status: 400 });

  const { perfumeId, itemId } = await addFromText(supabase, collectionId, input);

  const { data: p } = await supabase.from('perfumes').select('notes_top, notes_heart, notes_base').eq('id', perfumeId).single();
  if (p && !rowHasNotes(p)) {
    after(async () => {
      if (await claimLookup(createServiceClient(), collectionId, perfumeId)) await enrichPerfume(perfumeId);
    });
  }
  return Response.json({ perfumeId, itemId });
}
