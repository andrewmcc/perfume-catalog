'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { londonNow } from '@perfume/core';
import { Button } from '@/components/ui/button';
import { useWears } from './use-wears';
import { WearForm } from './wear-form';

/** One tap logs a wear for today (current time of day); then offers stars and a note. */
export function WearToday({ collectionId, itemId, label = 'Wear today', className = '' }: { collectionId: string; itemId: string; label?: string; className?: string }) {
  const router = useRouter();
  const api = useWears(collectionId);
  const [state, setState] = useState<'idle' | 'busy' | 'logged' | 'saved'>('idle');
  const [wearId, setWearId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [when, setWhen] = useState(() => londonNow(new Date()));

  async function wear() {
    setState('busy');
    setError(null);
    const now = londonNow(new Date());
    setWhen(now);
    try {
      setWearId(await api.log(itemId, { worn_on: now.date, time_of_day: now.daypart, rating: null, notes: null }));
      setState('logged');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('idle');
    }
  }

  if (state === 'idle' || state === 'busy')
    return (
      <div className={className}>
        <Button onClick={wear} disabled={state === 'busy'}>
          {label}
        </Button>
        {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
      </div>
    );
  if (state === 'saved') return <p className={`text-sm text-ink ${className}`} role="status">Worn ✓ · saved to your diary</p>;
  return (
    <div className={className}>
      <p className="text-sm text-ink" role="status">
        Worn ✓ · add a rating or note?
      </p>
      <div className="mt-2">
        <WearForm
          showDate={false}
          initial={{ wornOn: when.date, timeOfDay: when.daypart, rating: null, notes: '' }}
          onCancel={() => setState('saved')}
          onSave={async (p) => {
            await api.update(wearId!, { rating: p.rating, notes: p.notes, time_of_day: p.time_of_day });
            setState('saved');
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
