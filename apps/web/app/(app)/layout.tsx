import Link from 'next/link';
import { Suspense } from 'react';
import { AppNav } from '@/components/app-nav';
import { ScanLink, SettingsLink } from '@/components/header-links';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="min-h-dvh pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between py-1.5 pr-1.5 pl-5">
          <Link href="/today" className="font-display text-[22px] leading-none tracking-[0.1em] text-ink">
            FLACON
          </Link>
          <div className="flex items-center gap-1">
            <Suspense fallback={<span className="h-11 w-22" />}>
              <ScanLink />
              <SettingsLink />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6">{children}</main>
      <Suspense>
        <AppNav />
      </Suspense>
    </div>
  );
}
