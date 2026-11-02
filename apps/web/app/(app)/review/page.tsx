import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { ReviewQueue } from '@/components/review/review-queue';
import { loadQueue } from '@/lib/scans/queue';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Review' };

async function Queue() {
  await connection();
  const supabase = await createServerClient();
  return <ReviewQueue scans={await loadQueue(supabase)} />;
}

export default function Page() {
  return (
    <Suspense fallback={<h1 className="font-display text-2xl italic">Review</h1>}>
      <Queue />
    </Suspense>
  );
}
