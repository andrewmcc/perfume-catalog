import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { CollectionView } from '@/components/collection/collection-view';
import { loadCollection } from '@/lib/collection/load';
import { parseCollectionUrl } from '@/lib/collection/url-filters';
import { createServerClient } from '@/lib/supabase/server';
import { LoadingFlacon } from '@/components/ui/loading-flacon';

export const metadata: Metadata = { title: 'Collection' };

async function Collection({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const [{ rows, sets }, sp] = await Promise.all([loadCollection(await createServerClient()), searchParams]);
  const { view, filters } = parseCollectionUrl(sp);
  return <CollectionView rows={rows} sets={sets} initialView={view} initialFilters={filters} />;
}

export default function Page(props: PageProps<'/collection'>) {
  return (
    <Suspense fallback={<LoadingFlacon label="Opening your shelf…" />}>
      <Collection searchParams={props.searchParams} />
    </Suspense>
  );
}
