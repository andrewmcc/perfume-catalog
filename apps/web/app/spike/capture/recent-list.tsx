'use client';

import { useState } from 'react';
import type { BottleResult, PerfumeRead, SamplesResult, SetResult } from '@/lib/spike/extract-schema';
import type { QueuedCapture } from './capture-queue';

const joinParts = (parts: string[]) => parts.filter(Boolean).join(' · ') || '(unnamed)';
const perfumeLine = (p: PerfumeRead) => joinParts([p.house, p.name, p.concentration]);
const statuses = (p: PerfumeRead) => `house ${p.status.house}, name ${p.status.name}, conc ${p.status.concentration}`;

/** Readable summary lines; `empty` means the model recognised nothing usable (Review Focus 4). */
export function summarise(item: QueuedCapture): { lines: string[]; empty: boolean } {
  const { mode, result } = item;
  if (!result) return { lines: [], empty: false };
  if (mode === 'bottle') {
    const r = result as BottleResult;
    if (!r.is_perfume) return { lines: [], empty: true };
    return { lines: [perfumeLine(r.perfume), statuses(r.perfume)], empty: false };
  }
  if (mode === 'samples') {
    const r = result as SamplesResult;
    if (!r.is_perfume_photo || r.vials.length === 0) {
      return { lines: r.unreadable_count ? [`${r.unreadable_count} unreadable`] : [], empty: true };
    }
    return {
      lines: [
        `${r.vials.length} vials read, ${r.unreadable_count} unreadable`,
        ...r.vials.map((v) => `${perfumeLine(v)} (${statuses(v)})`),
      ],
      empty: false,
    };
  }
  const r = result as SetResult;
  if (!r.is_discovery_set || r.scents.length === 0) return { lines: [], empty: true };
  return {
    lines: [joinParts([r.set_house, r.set_name]), ...r.scents.map((s) => `${perfumeLine(s)} (${statuses(s)})`)],
    empty: false,
  };
}

function CaptureRow({ item, onRetry }: { item: QueuedCapture; onRetry: (i: QueuedCapture) => void }) {
  const [showJson, setShowJson] = useState(false);
  const { lines, empty } = summarise(item);
  return (
    <li className="mb-2 flex gap-2 border-b border-white/20 pb-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.thumb} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
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
