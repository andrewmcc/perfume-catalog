'use client';

import { useState } from 'react';
import { summarise } from '@/lib/spike/summarise';
import type { QueuedCapture } from './capture-queue';

function summariseItem(item: QueuedCapture): { lines: string[]; empty: boolean } {
  if (!item.result) return { lines: [], empty: false };
  const { recognised, lines } = summarise(item.mode, item.result);
  return { lines, empty: !recognised };
}

function CaptureRow({ item, onRetry }: { item: QueuedCapture; onRetry: (i: QueuedCapture) => void }) {
  const [showJson, setShowJson] = useState(false);
  const { lines, empty } = summariseItem(item);
  return (
    <li className="mb-2 flex gap-2 border-b border-white/20 pb-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.thumb ? <img src={item.thumb} alt="" className="h-12 w-12 shrink-0 rounded object-cover" /> : <div className="h-12 w-12 shrink-0 rounded bg-white/10" />}
      <div className="min-w-0 flex-1">
        <p className="text-neutral-400">
          {item.mode} · {item.status}
          {item.ms ? ` · ${(item.ms / 1000).toFixed(1)}s` : ''}
        </p>
        {empty && <p className="font-semibold text-amber-300">Nothing recognised</p>}
        {lines.map((l, i) => (
          <p key={i} className={i === 0 ? 'font-semibold' : 'text-neutral-300'}>
            {l}
          </p>
        ))}
        {item.status === 'failed' && (
          <div className="mt-1 flex items-center gap-2">
            <span className="min-w-0 flex-1 break-words text-red-400">{item.error}</span>
            <button onClick={() => onRetry(item)} className="rounded bg-white px-2 py-1 text-black">
              Retry
            </button>
          </div>
        )}
        {item.result && (
          <>
            <button onClick={() => setShowJson((v) => !v)} className="mt-1 text-neutral-400 underline">
              {showJson ? 'Hide JSON' : 'Show JSON'}
            </button>
            {showJson && <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(item.result, null, 2)}</pre>}
          </>
        )}
      </div>
    </li>
  );
}

export function RecentList({ items, onRetry }: { items: QueuedCapture[]; onRetry: (i: QueuedCapture) => void }) {
  return (
    <div className="absolute inset-x-0 bottom-28 top-20 z-30 mx-4 overflow-y-auto rounded bg-black/90 p-3 text-xs">
      <h2 className="mb-2 text-sm font-semibold">Recent</h2>
      {items.length === 0 && <p>Nothing captured yet.</p>}
      <ul>
        {items.map((it) => (
          <CaptureRow key={it.localId} item={it} onRetry={onRetry} />
        ))}
      </ul>
    </div>
  );
}
