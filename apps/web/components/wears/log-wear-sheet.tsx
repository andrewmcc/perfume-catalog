'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { searchKey } from '@perfume/core';
import { Button } from '@/components/ui/button';
import { AddSheet } from '@/components/collection/add-sheet';
import { label } from '@/components/collection/labels';
import type { Wearable } from '@/lib/wears/load';
import { useWears } from './use-wears';
import { WearForm } from './wear-form';
import { Sheet } from '@/components/ui/sheet';

/** "Log a wear": search the shelf, pick an item, then date, time, stars and notes. */
export function LogWearSheet({ wearables, collectionId, defaultDate }: { wearables: Wearable[]; collectionId: string; defaultDate: string }) {
  const router = useRouter();
  const wears = useWears(collectionId);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Wearable | null>(null);

  const close = () => {
    setOpen(false);
    setPicked(null);
    setQ('');
  };
  const needle = searchKey(q);
  const shown = needle ? wearables.filter((w) => searchKey(`${w.house} ${w.name}`).includes(needle)) : wearables;

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full">
        Log a wear
      </Button>
      {open && (
        <Sheet label="Log a wear" onClose={close}>
            <h2 className="font-display text-xl italic">{picked ? `${picked.name}` : 'What did you wear?'}</h2>
            {picked ? (
              <>
                <p className="mb-3 text-[12px] tracking-[0.14em] text-muted uppercase">{picked.house}</p>
                <WearForm
                  initial={{ wornOn: defaultDate, timeOfDay: null, rating: null, notes: '' }}
                  saveLabel="Log it"
                  onCancel={() => setPicked(null)}
                  onSave={async (p) => {
                    await wears.log(picked.itemId, p);
                    close();
                    router.refresh();
                  }}
                />
              </>
            ) : wearables.length === 0 ? (
              <>
                <p className="mt-3 text-sm text-muted">Nothing on your shelf yet. Scan a bottle from the icon at the top, or add one by name.</p>
                <AddSheet
                  defaultStatus="owned"
                  ownedOnly
                  trigger="Add it by name"
                  triggerClassName="mt-2 min-h-11 text-sm text-oxblood underline underline-offset-4"
                  onAdded={(a) => setPicked({ itemId: a.itemId, perfumeId: a.perfumeId, house: a.house, name: a.name, format: 'full', setName: null })}
                />
              </>
            ) : (
              <>
                <input
                  type="search"
                  autoFocus
                  aria-label="Search your shelf"
                  placeholder="Search your shelf…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="mt-3 min-h-11 w-full rounded-[3px] border border-line bg-card px-3 text-[16px] text-ink placeholder:text-muted/70 focus:border-oxblood focus:outline-none"
                />
                <ul className="mt-2">
                  {shown.map((w) => (
                    <li key={w.itemId} className="border-b border-line-soft last:border-0">
                      <button onClick={() => setPicked(w)} className="flex min-h-12 w-full flex-col items-start py-2 text-left">
                        <span className="text-[12px] tracking-[0.14em] text-muted uppercase">{w.house}</span>
                        <span className="font-display text-[17px] text-ink">
                          {w.name}
                          {w.format !== 'full' && <span className="ml-2 font-sans text-[13px] text-muted">{label(w.format)}{w.setName ? ` · ${w.setName}` : ''}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                  {shown.length === 0 && <li className="py-3 text-sm text-muted">Nothing matches “{q}”.</li>}
                </ul>
                <AddSheet
                  key={q}
                  defaultStatus="owned"
                  ownedOnly
                  initialText={q.trim()}
                  trigger="Not on your shelf? Add it by name"
                  triggerClassName="mt-2 min-h-11 text-sm text-oxblood underline underline-offset-4"
                  onAdded={(a) => setPicked({ itemId: a.itemId, perfumeId: a.perfumeId, house: a.house, name: a.name, format: 'full', setName: null })}
                />
              </>
            )}
        </Sheet>
      )}
    </>
  );
}
