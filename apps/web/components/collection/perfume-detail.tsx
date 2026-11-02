'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@perfume/supabase';
import type { FactField, Source } from '@perfume/core';
import { ScentPyramid } from '@/components/brand/pyramid';
import { CONCENTRATION_LABEL } from '@/components/review/edits';
import { overridePatch } from '@/lib/collection/overrides';
import type { PerfumeDetail as Detail } from '@/lib/collection/perfume';
import { FactsEditForm } from './facts-edit-form';
import { ItemCard } from './item-card';
import type { ItemPatch } from './item-edit-form';
import { label } from './labels';
import { SourceBadge } from './source-badge';
import Link from 'next/link';
import { StarRating } from '@/components/wears/star-rating';
import { WearToday } from '@/components/wears/wear-today';
import { dayAndMonth, shortDay } from '@/lib/dates';

const list = (v: unknown) => ((v as string[] | null) ?? []).map(label).join(', ');

function Fact({ title, source, children }: { title: string; source: Source | null; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2 last:border-0">
      <dt className="shrink-0 text-sm text-muted">{title}</dt>
      <dd className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 gap-y-1 text-right text-[15px] text-ink">
        <span>{children}</span>
        <SourceBadge source={source} />
      </dd>
    </div>
  );
}

export function PerfumeDetail({ detail }: { detail: Detail }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { values: v, source: s } = detail;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const check = ({ error }: { error: { message: string } | null }) => {
    if (error) throw new Error(error.message);
  };

  const saveFacts = (edits: Record<FactField, unknown>) =>
    run(async () => {
      for (const item of detail.items) {
        const overrides = overridePatch(item.overrides, detail.facts as unknown as Record<string, unknown>, edits);
        check(await supabase.from('items').update({ overrides: overrides as never }).eq('id', item.id));
      }
      setEditing(false);
    });
  const saveItem = (id: string, p: ItemPatch) => run(async () => check(await supabase.from('items').update(p).eq('id', id)));
  const setStatus = (id: string, status: 'owned' | 'gone') => run(async () => check(await supabase.from('items').update({ status }).eq('id', id)));
  const remove = (id: string) =>
    run(async () => {
      check(await supabase.from('items').delete().eq('id', id));
      if (detail.items.length === 1) router.push('/collection');
    });

  const notes = [
    ['Top', v.notes_top, s.notes_top],
    ['Heart', v.notes_heart, s.notes_heart],
    ['Base', v.notes_base, s.notes_base],
  ] as const;
  const hasNotes = notes.some(([, n]) => (n as string[]).length > 0);
  const year = v.release_year as number | null;
  const facts: [string, FactField, string][] = (
    [
      ['Family', 'family', [v.family && label(v.family as string), v.subfamily].filter(Boolean).join(' · ')],
      ['Accords', 'accords', list(v.accords)],
      ['Longevity', 'longevity', v.longevity ? label(v.longevity as string) : ''],
      ['Sillage', 'sillage', v.sillage ? label(v.sillage as string) : ''],
      ['Seasons', 'seasons', list(v.seasons)],
      ['Time of day', 'times_of_day', list(v.times_of_day)],
      ['Occasions', 'occasions', list(v.occasions)],
      ['Perfumer', 'perfumers', ((v.perfumers as string[]) ?? []).join(', ')],
      ['Released', 'release_year', year ? String(year) : ''],
    ] as [string, FactField, string][]
  ).filter(([, , text]) => text);

  return (
    <article>
      {detail.hero && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={detail.hero} alt="" className="label-card mb-5 aspect-square w-full object-cover p-1" />
      )}
      <p className="text-[12px] tracking-[0.16em] text-muted uppercase">{detail.house}</p>
      <h1 className="font-display text-3xl leading-tight italic">{detail.name}</h1>
      {Boolean(v.concentration || v.flanker) && (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
          {[v.concentration && (CONCENTRATION_LABEL[v.concentration as string] ?? (v.concentration as string)), v.flanker].filter(Boolean).join(' · ')}
          <SourceBadge source={s.concentration ?? s.flanker} />
        </p>
      )}

      <section aria-label="Your stats" className="mt-4">
        <p className="text-[15px] text-ink">
          {detail.wear.count === 0
            ? 'Not worn yet'
            : [`Worn ${detail.wear.count}×`, detail.wear.avgRating != null && `avg ★${detail.wear.avgRating}`, detail.wear.lastWorn && `last worn ${dayAndMonth(detail.wear.lastWorn)}`].filter(Boolean).join(' · ')}
        </p>
        {detail.wearItemId && <WearToday collectionId={detail.collectionId} itemId={detail.wearItemId} className="mt-3" />}
      </section>

      <section aria-label="Scent pyramid" className="label-card mt-5 flex gap-4 p-4">
        <ScentPyramid weight={detail.weight} size={64} />
        {hasNotes ? (
          <dl className="min-w-0 flex-1 text-sm">
            {notes.map(([tier, n, src]) => (
              <div key={tier} className="py-0.5">
                <dt className="inline text-muted">{tier}: </dt>
                <dd className="inline text-ink">{(n as string[]).join(', ') || '—'}</dd> <SourceBadge source={src} />
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted">Notes unknown. Add them with Edit details.</p>
        )}
      </section>

      {facts.length > 0 && (
        <dl className="label-card mt-4 px-4 py-1">
          {facts.map(([title, k, text]) => (
            <Fact key={k} title={title} source={s[k]}>
              {text}
            </Fact>
          ))}
        </dl>
      )}

      {editing ? (
        <FactsEditForm values={v} busy={busy} onSave={saveFacts} onCancel={() => setEditing(false)} />
      ) : (
        <button onClick={() => setEditing(true)} className="mt-3 min-h-11 text-sm text-oxblood underline underline-offset-4">
          Edit details
        </button>
      )}

      {detail.notes.length > 0 && (
        <section aria-label="Your notes" className="mt-6">
          <h2 className="font-display text-xl italic">
            Your notes{detail.wear.avgRating != null && <span className="ml-2 font-sans text-sm text-muted not-italic">avg ★{detail.wear.avgRating}</span>}
          </h2>
          <ul className="label-card mt-3 px-4">
            {detail.notes.map((n) => (
              <li key={n.id} className="border-b border-line-soft py-3 last:border-0">
                <Link href={`/diary?m=${n.wornOn.slice(0, 7)}&d=${n.wornOn}`} className="block">
                  <p className="flex items-center gap-2 text-[12px] tracking-[0.14em] text-muted uppercase">
                    {shortDay(n.wornOn)} <StarRating value={n.rating} className="text-[13px] tracking-normal" />
                  </p>
                  {n.notes && <p className="mt-1 text-[15px] whitespace-pre-line text-ink">{n.notes}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mt-6 font-display text-xl italic">On your shelf</h2>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {detail.items.map((item) => (
          <ItemCard key={item.id} item={item} busy={busy} onSave={(p) => saveItem(item.id, p)} onStatus={(st) => setStatus(item.id, st)} onDelete={() => remove(item.id)} />
        ))}
      </ul>
    </article>
  );
}
