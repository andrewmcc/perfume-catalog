'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@perfume/supabase';
import type { SetDetail as Detail } from '@/lib/collection/perfume';
import { ConfirmButton } from './confirm-button';

export function SetDetail({ set }: { set: Detail }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    const { error: e } = await supabase.from('sets').delete().eq('id', set.id);
    if (e) return setError(e.message);
    router.push('/collection');
    router.refresh();
  }
  return (
    <article>
      <p className="text-[12px] tracking-[0.16em] text-muted uppercase">{set.house ?? 'Discovery set'}</p>
      <h1 className="font-display text-3xl leading-tight italic">{set.name ?? 'Unnamed set'}</h1>
      <p className="mt-1 text-muted">{set.items.length === 1 ? '1 sample' : `${set.items.length} samples`}</p>
      {set.items.length > 0 && (
        <ul className="label-card mt-5 px-4">
          {set.items.map((i) => (
            <li key={i.id} className="border-b border-line-soft last:border-0">
              <Link href={`/collection/${i.perfumeId}`} className="flex min-h-11 items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-[12px] tracking-[0.14em] text-muted uppercase">{i.house}</span>
                  <span className="font-display text-[18px] text-ink">{i.name}</span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {i.status === 'gone' && <span className="rounded-full border border-line px-2 py-px text-[12px] text-muted">Gone</span>}
                  <span className={`rounded-full border px-2 py-px text-[12px] ${i.tried ? 'border-gold-deep text-gold-deep' : 'border-line text-muted'}`}>{i.tried ? 'Tried' : 'Untried'}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5">
        <ConfirmButton label="Delete set" confirm="Delete the set? Its samples stay." onConfirm={remove} />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </article>
  );
}
