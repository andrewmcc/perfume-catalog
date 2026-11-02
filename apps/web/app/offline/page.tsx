import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline', robots: { index: false } };

/** Precached by /sw.js and shown when a navigation fails because the device is offline. */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 py-10">
      <p className="font-display text-5xl leading-none tracking-[0.08em] text-oxblood">Flacon</p>
      <h1 className="font-display text-2xl italic">You're offline.</h1>
      <p className="text-[17px] leading-relaxed text-muted">Flacon needs a connection to load your collection.</p>
      {/* An empty href reloads the page; the service worker serves it from the network once back online. */}
      <a href="" className="inline-flex min-h-11 items-center self-start text-oxblood underline underline-offset-4">
        Try again
      </a>
    </main>
  );
}
