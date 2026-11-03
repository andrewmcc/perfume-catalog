'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ItemDetail } from '@/lib/collection/perfume';
import { ConfirmButton } from './confirm-button';
import { ItemEditForm, type ItemPatch } from './item-edit-form';
import { label } from './labels';
import { NoPhoto } from '@/components/ui/no-photo';

const money = (n: number) => `£${n.toFixed(2).replace(/\.00$/, '')}`;

/** One bottle, sample or decant of this perfume, with its own details and actions. */
export function ItemCard({
  item,
  busy,
  onSave,
  onStatus,
  onDelete,
}: {
  item: ItemDetail;
  busy: boolean;
  onSave: (p: ItemPatch) => Promise<void>;
  onStatus: (s: 'owned' | 'gone') => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const line = [label(item.format), item.size_ml && `${item.size_ml} ml`].filter(Boolean).join(' · ');
  const bought = [item.purchase_price != null && money(item.purchase_price), item.purchase_source, item.purchased_on].filter(Boolean).join(' · ');
  return (
    <li className="label-card p-4">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {item.photo ? <img src={item.photo} alt="" className="h-16 w-16 shrink-0 rounded-[3px] object-cover" /> : <NoPhoto className="h-16 w-16" />}
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-[15px] text-ink">
            {line}
            {item.status === 'gone' && <span className="ml-2 rounded-full border border-line px-2 py-px text-[12px] text-muted">Gone</span>}
            {item.status === 'wishlist' && <span className="ml-2 rounded-full border border-gold-deep px-2 py-px text-[12px] text-gold-deep">Wishlist</span>}
          </p>
          {item.setName && item.setId && (
            <p className="text-muted">
              From{' '}
              <Link href={`/collection/sets/${item.setId}`} className="text-oxblood underline underline-offset-4">
                {item.setName}
              </Link>
            </p>
          )}
          {bought && <p className="text-muted">{bought}</p>}
          {item.batch_code && <p className="text-muted">Batch {item.batch_code}</p>}
          {item.wish_reason && <p className="text-muted italic">{item.wish_reason}</p>}
          {item.notes && <p className="mt-1 text-ink">{item.notes}</p>}
        </div>
      </div>
      {editing ? (
        <ItemEditForm item={item} busy={busy} onCancel={() => setEditing(false)} onSave={(p) => void onSave(p).then(() => setEditing(false))} />
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-5">
          <button onClick={() => setEditing(true)} disabled={busy} className="min-h-11 px-1 text-sm text-oxblood underline underline-offset-4">
            Edit
          </button>
          <button onClick={() => onStatus(item.status === 'owned' ? 'gone' : 'owned')} disabled={busy} className="min-h-11 px-1 text-sm text-oxblood underline underline-offset-4">
            {item.status === 'wishlist' ? 'Move to owned' : item.status === 'gone' ? 'Back on the shelf' : 'Mark gone'}
          </button>
          <ConfirmButton label="Delete" confirm="Delete this item?" disabled={busy} onConfirm={onDelete} />
        </div>
      )}
    </li>
  );
}
