import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { RATING_OPTIONS, WORN_OPTIONS, type Filters } from '@perfume/core';
import { CollectionView } from '@/components/collection/collection-view';
import { loadCollection } from '@/lib/collection/load';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Collection' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Filters seeded from the URL, e.g. /collection?worn=neglected from Stats. Unknown values are ignored. */
function urlFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const f: Filters = {};
  const worn = one(sp.worn);
  const rating = one(sp.rating);
  if (worn && (WORN_OPTIONS as readonly string[]).includes(worn)) f.worn = [worn];
  if (rating && (RATING_OPTIONS as readonly string[]).includes(rating)) f.rating = [rating];
  return f;
}

async function Collection({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const [{ rows, sets }, sp] = await Promise.all([loadCollection(await createServerClient()), searchParams]);
  return <CollectionView rows={rows} sets={sets} initialFilters={urlFilters(sp)} />;
}

export default function Page(props: PageProps<'/collection'>) {
  return (
    <Suspense fallback={<h1 className="font-display text-2xl italic">Collection</h1>}>
      <Collection searchParams={props.searchParams} />
    </Suspense>
  );
}
