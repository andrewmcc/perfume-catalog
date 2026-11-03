'use client';

import Link from 'next/link';
import { summarise } from '@/lib/scans/summarise';
import type { ScanItem } from './use-scan-queue';
import { NoPhoto } from '@/components/ui/no-photo';

function status(item: ScanItem): { label: string; tone: 'muted' | 'danger' | 'ok' } {
  if (item.stage === 'failed') return { label: 'Not sent', tone: 'danger' };
  if (item.stage !== 'done') return { label: item.stage === 'uploading' ? 'Uploading…' : 'Saving…', tone: 'muted' };
  switch (item.serverStatus) {
    case 'extracted':
      return { label: 'Read', tone: 'ok' };
    case 'discarded':
      return { label: 'Not perfume', tone: 'muted' };
    case 'failed':
      return { label: 'Couldn’t read', tone: 'danger' };
    default:
      return { label: 'Reading…', tone: 'muted' };
  }
}

function Row({ item, onRetry }: { item: ScanItem; onRetry: (i: ScanItem) => void }) {
  const s = status(item);
  const summary = item.result && item.serverStatus === 'extracted' ? summarise(item.mode, item.result) : null;
  const failed = item.stage === 'failed' || item.serverStatus === 'failed';
  return (
    <li className="flex gap-3 border-b border-line-soft py-3 last:border-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.thumb ? <img src={item.thumb} alt="" className="h-14 w-14 shrink-0 rounded-[3px] object-cover" /> : <NoPhoto className="h-14 w-14" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs tracking-wide text-muted uppercase">
          {item.mode} ·{' '}
          <span className={s.tone === 'danger' ? 'text-danger' : s.tone === 'ok' ? 'text-oxblood' : ''}>{s.label}</span>
        </p>
        {summary?.lines.map((l, i) => (
          <p key={i} className={i === 0 ? 'font-display text-[17px] leading-snug text-ink' : 'text-sm text-muted'}>
            {l}
          </p>
        ))}
        {failed && (
          <div className="mt-1 flex items-center gap-3">
            <span className="min-w-0 flex-1 text-sm break-words text-danger">{item.error}</span>
            <button onClick={() => onRetry(item)} className="min-h-11 px-2 text-sm text-oxblood underline underline-offset-4">
              Retry
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

/** This visit's captures, newest first. */
export function RecentCaptures({ items, onRetry, onClose }: { items: ScanItem[]; onRetry: (i: ScanItem) => void; onClose: () => void }) {
  return (
    <section aria-label="Recent captures" className="label-card absolute inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-30 flex flex-col text-ink">
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="font-display text-xl italic">Recent</h2>
        {items.some((i) => i.serverStatus === 'extracted') && (
          <Link href="/review" className="ml-auto min-h-11 px-2 pt-3 text-sm text-oxblood underline underline-offset-4">
            Review
          </Link>
        )}
        <button onClick={onClose} className="min-h-11 px-2 text-sm text-oxblood underline underline-offset-4">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        {items.length === 0 ? <p className="py-6 text-sm text-muted">Nothing captured yet.</p> : <ul>{items.map((it) => <Row key={it.scanId} item={it} onRetry={onRetry} />)}</ul>}
      </div>
    </section>
  );
}
