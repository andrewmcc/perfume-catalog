import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReviewNotice } from '@/components/review/review-notice';
import { ProcessPending } from '@/components/scan/process-pending';

export const metadata: Metadata = { title: 'Today' };

export default function Page() {
  return (
    <>
      <ProcessPending />
      <Suspense>
        <ReviewNotice />
      </Suspense>
      <h1 className="font-display text-2xl italic">Today</h1>
      <p className="mt-2 text-muted">Tonight's picks, chosen for the weather and your shelf, arrive here.</p>
    </>
  );
}
