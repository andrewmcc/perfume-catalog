'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/today', label: 'Today' },
  { href: '/collection', label: 'Collection' },
  { href: '/diary', label: 'Diary' },
  { href: '/stats', label: 'Stats' },
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-xl grid-cols-4 items-center">
        {TABS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[13px] ${active ? 'font-semibold text-oxblood' : 'text-muted'}`}
            >
              <span className={`h-1.5 w-1.5 rotate-45 ${active ? 'bg-gold-deep' : 'bg-transparent'}`} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
