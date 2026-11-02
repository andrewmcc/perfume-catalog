import { getCurrentCollectionId } from '@/lib/collections/current';
import { resolveLocation } from '@/lib/settings/location';
import { createServerClient } from '@/lib/supabase/server';

async function member() {
  const supabase = await createServerClient();
  const collectionId = await getCurrentCollectionId(supabase);
  return { supabase, collectionId };
}

/** Sets the collection's location from `{ postcode }` or `{ lat, lon }`. Only rounded coordinates are stored. */
export async function POST(request: Request) {
  const { supabase, collectionId } = await member();
  if (!collectionId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const r = await resolveLocation(await request.json().catch(() => null));
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  const { error } = await supabase.from('collection_settings').upsert({ collection_id: collectionId, lat: r.lat, lon: r.lon, place: r.place });
  if (error) return Response.json({ error: 'Could not save your location.' }, { status: 500 });
  return Response.json({ place: r.place });
}

/** Clears the collection's location. */
export async function DELETE() {
  const { supabase, collectionId } = await member();
  if (!collectionId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { error } = await supabase.from('collection_settings').update({ lat: null, lon: null, place: null }).eq('collection_id', collectionId);
  if (error) return Response.json({ error: 'Could not clear your location.' }, { status: 500 });
  return new Response(null, { status: 204 });
}
