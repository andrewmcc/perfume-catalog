import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ReviewQueue } from '@/components/review/review-queue';
import { loadQueue } from '@/lib/scans/queue';
import { createServerClient } from '@/lib/supabase/server';
import { LoadingFlacon } from '@/components/ui/loading-flacon';

export const metadata: Metadata = { title: 'Review' };

async function Queue() {
  await connection();
  const supabase = await createServerClient();
  return <ReviewQueue scans={await loadQueue(supabase)} />;
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingFlacon label="Fetching your scans…" />}>
      <Queue />
    </Suspense>
  );
}
