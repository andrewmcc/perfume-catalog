'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CollectionItem, CollectionRow } from '@perfume/core';
import { ScentPyramid } from '@/components/brand/pyramid';
import { label } from './labels';

const itemLine = (i: CollectionItem) => [label(i.format), i.size_ml && `${i.size_ml} ml`, i.setName && `from ${i.setName}`].filter(Boolean).join(' · ');

/** One perfume: thumbnail, house in small capitals, name in Bodoni, the pyramid; items listed when there are several. */
export function PerfumeRow({ row, items, line }: { row: CollectionRow; items: CollectionItem[]; line?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-line-soft last:border-0">
      <div className="flex items-center gap-3 py-3">
        <Link href={`/collection/${row.perfumeId}`} className="flex min-w-0 flex-1 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {row.thumb ? <img src={row.thumb} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-[3px] object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-[3px] bg-line-soft" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] tracking-[0.14em] text-muted uppercase">{row.house}</p>
            <p className="font-display text-[18px] leading-snug text-ink">{row.name}</p>
            {line ? <p className="text-[13px] text-muted">{line}</p> : items.length === 1 && <p className="text-[13px] text-muted">{itemLine(items[0]!)}</p>}
          </div>
          <ScentPyramid weight={row.weight} size={30} />
        </Link>
        {!line && items.length > 1 && (
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-h-11 shrink-0 px-1 text-[13px] text-oxblood underline underline-offset-4">
            {items.length} items
          </button>
        )}
      </div>
      {open && (
        <ul className="pb-3 pl-[4.25rem] text-[13px] text-muted">
          {items.map((i) => (
            <li key={i.id} className="py-0.5">
              {itemLine(i)}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
