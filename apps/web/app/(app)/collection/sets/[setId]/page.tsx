import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SetDetail } from '@/components/collection/set-detail';
import { loadSet } from '@/lib/collection/perfume';
import { createServerClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function SetPage({ params }: { params: Promise<{ setId: string }> }) {
  await connection();
  const { setId } = await params;
  if (!UUID.test(setId)) notFound();
  const set = await loadSet(await createServerClient(), setId);
  if (!set) notFound();
  return <SetDetail set={set} />;
}

export default function Page(props: PageProps<'/collection/sets/[setId]'>) {
  return (
    <Suspense fallback={<div className="h-80" />}>
      <SetPage params={props.params} />
    </Suspense>
  );
}
