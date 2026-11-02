import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { CaptureView } from '@/components/scan/capture-view';
import { ProcessPending } from '@/components/scan/process-pending';
import { getCurrentCollectionId } from '@/lib/collections/current';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Scan' };

async function Scanner() {
  // Request-time only: the Supabase auth client reads the clock while it starts.
  await connection();
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const collectionId = user ? await getCurrentCollectionId(supabase) : null;
  if (!user || !collectionId) {
    return (
      <>
        <h1 className="font-display text-2xl italic">Scan</h1>
        <p className="mt-2 text-muted">You’re not in a collection yet, so there’s nowhere to add scans. Ask the collection’s owner to invite you.</p>
      </>
    );
  }
  return (
    <>
      <ProcessPending />
      <CaptureView collectionId={collectionId} userId={user.id} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-50 bg-paper" />}>
      <Scanner />
    </Suspense>
  );
}
