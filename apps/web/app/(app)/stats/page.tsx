import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Stats' };

export default function Page() {
  return (
    <>
      <h1 className="font-display text-2xl italic">Stats</h1>
      <p className="mt-2 text-muted">Gaps in your shelf, favourites and neglected bottles are coming.</p>
    </>
  );
}
