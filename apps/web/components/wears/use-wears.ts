'use client';

import { useMemo } from 'react';
import { createBrowserClient } from '@perfume/supabase';
import { asWearInsert } from '@/lib/wears/insert';
import type { WearPatch } from './wear-patch';

const check = ({ error }: { error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
};

/** Insert, update and delete wears with the member's session (RLS confines them to the collection). */
export function useWears(collectionId: string) {
  const supabase = useMemo(() => createBrowserClient(), []);
  return useMemo(
    () => ({
      async log(itemId: string, p: WearPatch): Promise<string> {
        const { data, error } = await supabase.from('wears').insert(asWearInsert({ collection_id: collectionId, item_id: itemId, ...p })).select('id').single();
        if (error) throw new Error(error.message);
        return data.id;
      },
      async update(id: string, p: Partial<WearPatch>) {
        check(await supabase.from('wears').update(p).eq('id', id));
      },
      async remove(id: string) {
        check(await supabase.from('wears').delete().eq('id', id));
      },
    }),
    [supabase, collectionId],
  );
}
