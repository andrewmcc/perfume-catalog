import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PerfumeDetail } from '@/components/collection/perfume-detail';
import { loadPerfume } from '@/lib/collection/perfume';
import { createServerClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Perfume({ params }: { params: Promise<{ perfumeId: string }> }) {
  await connection();
  const { perfumeId } = await params;
  if (!UUID.test(perfumeId)) notFound();
  const detail = await loadPerfume(await createServerClient(), perfumeId);
  if (!detail) notFound();
  return <PerfumeDetail detail={detail} />;
}

export default function Page(props: PageProps<'/collection/[perfumeId]'>) {
  return (
    <Suspense fallback={<div className="h-80" />}>
      <Perfume params={props.params} />
    </Suspense>
  );
}
