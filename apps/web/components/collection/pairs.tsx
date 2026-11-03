import Link from 'next/link';
import { Suspense } from 'react';
import { pairKey, pairReason, type Pair } from '@perfume/core';
import { loadCollection } from '@/lib/collection/load';
import { getCurrentCollectionId } from '@/lib/collections/current';
import { pairReasons } from '@/lib/pairs/model-reasons';
import { pairsFor } from '@/lib/pairs/select';
import { createServerClient } from '@/lib/supabase/server';

type Reasons = Promise<Record<string, string> | null>;

async function ModelLine({ reasons, k, fallback }: { reasons: Reasons; k: string; fallback: string }) {
  return <>{(await reasons)?.[k] ?? fallback}</>;
}

function PairList({ title, kind, pairs, reasons }: { title: string; kind: 'like' | 'layer'; pairs: Pair[]; reasons: Reasons }) {
  if (!pairs.length) return null;
  return (
    <section aria-label={title} className="mt-6">
      <h2 className="font-display text-xl italic">{title}</h2>
      <ul className="label-card mt-2 px-4">
        {pairs.map((p) => {
          const rule = pairReason(p, kind);
          return (
            <li key={p.perfume.perfumeId} className="border-b border-line-soft last:border-0">
              <Link href={`/collection/${p.perfume.perfumeId}`} className="flex min-h-11 items-start gap-3 py-3">
                <span aria-hidden className="mt-1 text-gold-deep">
                  {kind === 'like' ? '♢' : '+'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] tracking-[0.14em] text-muted uppercase">
                    {p.perfume.house}
                    {p.perfume.sample && ' · sample'}
                  </span>
                  <span className="block font-display text-[18px] leading-snug text-ink">{p.perfume.name}</span>
                  <span className="block text-[13px] text-muted">
                    <Suspense fallback={rule}>
                      <ModelLine reasons={reasons} k={pairKey(kind, p)} fallback={rule} />
                    </Suspense>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Smells like — on your shelf" and "Layer with", from the perfumes the collection owns. */
export async function Pairs({ perfumeId }: { perfumeId: string }) {
  const supabase = await createServerClient();
  const [{ rows }, collectionId] = await Promise.all([loadCollection(supabase), getCurrentCollectionId(supabase)]);
  const pairs = pairsFor(rows, perfumeId);
  if (!pairs || !collectionId || (!pairs.likes.length && !pairs.layers.length)) return null;
  const reasons = pairReasons(collectionId, pairs);
  return (
    <>
      <PairList title="Smells like — on your shelf" kind="like" pairs={pairs.likes} reasons={reasons} />
      <PairList title="Layer with" kind="layer" pairs={pairs.layers} reasons={reasons} />
    </>
  );
}
