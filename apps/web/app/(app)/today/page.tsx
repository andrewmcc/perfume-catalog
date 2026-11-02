import type { Metadata } from 'next';
import { ProcessPending } from '@/components/scan/process-pending';

export const metadata: Metadata = { title: 'Today' };

export default function Page() {
  return (
    <>
      <ProcessPending />
      <h1 className="font-display text-2xl italic">Today</h1>
      <p className="mt-2 text-muted">Tonight's picks, chosen for the weather and your shelf, arrive here.</p>
    </>
  );
}
