import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Diary' };

export default function Page() {
  return (
    <>
      <h1 className="font-display text-2xl italic">Diary</h1>
      <p className="mt-2 text-muted">A month view of what you wore, with your notes, is coming.</p>
    </>
  );
}
