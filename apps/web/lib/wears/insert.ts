import type { Database } from '@perfume/supabase';

type Insert = Database['public']['Tables']['wears']['Insert'];
/** A wear as clients send it: perfume_id is set by the database from the item. */
export type WearInsert = Omit<Insert, 'perfume_id' | 'id' | 'created_at' | 'updated_at' | 'created_by'> & { item_id: string };

/** Cast for supabase-js, whose generated Insert type requires perfume_id. */
export const asWearInsert = (w: WearInsert) => w as Insert;
