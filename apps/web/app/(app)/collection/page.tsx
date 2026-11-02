import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Collection' };

export default function Page() {
  return (
    <>
      <h1 className="font-display text-2xl italic">Collection</h1>
      <p className="mt-2 text-muted">Your bottles, samples and wishlist will be listed here.</p>
    </>
  );
}
