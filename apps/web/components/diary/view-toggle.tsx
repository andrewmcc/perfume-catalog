import Link from 'next/link';

/** Month · Year switch above the diary calendar. */
export function ViewToggle({ view, monthHref, yearHref }: { view: 'month' | 'year'; monthHref: string; yearHref: string }) {
  const cls = (on: boolean) => `flex min-h-11 flex-1 items-center justify-center rounded-[3px] text-sm ${on ? 'bg-oxblood text-paper' : 'text-ink'}`;
  return (
    <nav aria-label="Diary view" className="label-card mb-3 flex p-1">
      <Link href={monthHref} aria-current={view === 'month' ? 'page' : undefined} className={cls(view === 'month')}>
        Month
      </Link>
      <Link href={yearHref} aria-current={view === 'year' ? 'page' : undefined} className={cls(view === 'year')}>
        Year
      </Link>
    </nav>
  );
}
