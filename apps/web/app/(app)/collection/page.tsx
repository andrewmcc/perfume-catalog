import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { CollectionView } from '@/components/collection/collection-view';
import { loadCollection } from '@/lib/collection/load';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Collection' };

async function Collection() {
  await connection();
  const { rows, sets } = await loadCollection(await createServerClient());
  return <CollectionView rows={rows} sets={sets} />;
}

export default function Page() {
  return (
    <Suspense fallback={<h1 className="font-display text-2xl italic">Collection</h1>}>
      <Collection />
    </Suspense>
  );
}
