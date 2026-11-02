import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Scan' };

export default function Page() {
  return (
    <>
      <h1 className="font-display text-2xl italic">Scan</h1>
      <p className="mt-2 text-muted">Photograph a bottle, a set or a sample card to add it. Coming soon.</p>
    </>
  );
}
