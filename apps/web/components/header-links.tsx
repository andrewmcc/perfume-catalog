'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

function HeaderLink({ href, label, active, accent = false, children }: { href: string; label: string; active: boolean; accent?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex size-11 items-center justify-center hover:text-oxblood ${active || accent ? 'text-oxblood' : 'text-muted'}`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </Link>
  );
}

/** Viewfinder corners around a small bottle. */
export function ScanLink() {
  const pathname = usePathname();
  return (
    <HeaderLink href="/scan" label="Scan a bottle" accent active={pathname.startsWith('/scan') || pathname.startsWith('/review')}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <rect x="9" y="9" width="6" height="8" rx="1" />
      <path d="M11 6.5h2V9h-2z" />
    </HeaderLink>
  );
}

export function SettingsLink() {
  return (
    <HeaderLink href="/settings" label="Settings" active={usePathname() === '/settings'}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </HeaderLink>
  );
}
