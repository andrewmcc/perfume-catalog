'use client';

import { useState } from 'react';
import { gapWishReason, type Gap, type GapSuggestion } from '@perfume/core';
import { Button } from '@/components/ui/button';

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'shown'; picks: GapSuggestion[] } | { kind: 'error'; message: string };

/** One gap: what's missing, then AI suggestions on request, each with "Want this". */
export function GapCard({ gap }: { gap: Gap }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [wanted, setWanted] = useState<Record<string, 'saving' | 'done' | 'error'>>({});

  async function load() {
    setState({ kind: 'loading' });
    const res = await fetch(`/api/gaps/${gap.id}`);
    const json = (await res.json().catch(() => ({}))) as { suggestions?: GapSuggestion[]; error?: string };
    setState(res.ok && json.suggestions ? { kind: 'shown', picks: json.suggestions } : { kind: 'error', message: json.error ?? 'Couldn’t get suggestions just now. Try again.' });
  }
  async function want(p: GapSuggestion) {
    const key = `${p.house}|${p.name}`;
    setWanted((w) => ({ ...w, [key]: 'saving' }));
    const res = await fetch('/api/items/from-text', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ house: p.house, name: p.name, concentration: p.concentration, status: 'wishlist', reason: gapWishReason(gap.id) }),
    });
    setWanted((w) => ({ ...w, [key]: res.ok ? 'done' : 'error' }));
  }

  return (
    <li className="label-card p-4">
      <p className="text-[15px] text-ink">
        {gap.title} — {gap.count} in {gap.total}.
      </p>
      {state.kind === 'idle' && (
        <Button variant="secondary" onClick={() => void load()} className="mt-3 px-3">
          See suggestions
        </Button>
      )}
      {state.kind === 'loading' && <p className="mt-3 text-sm text-muted">Thinking of a few…</p>}
      {state.kind === 'error' && (
        <p role="status" className="mt-3 text-sm text-danger">
          {state.message}
        </p>
      )}
      {state.kind === 'shown' &&
        (state.picks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No suggestions this time.</p>
        ) : (
          <>
            <p className="mt-3 w-fit rounded-full border border-gold-deep/60 px-2 py-px text-[11px] text-gold-deep">Suggested by AI</p>
            <ul className="mt-1">
              {state.picks.map((p) => {
                const s = wanted[`${p.house}|${p.name}`];
                return (
                  <li key={`${p.house}|${p.name}`} className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] tracking-[0.14em] text-muted uppercase">{p.house}</p>
                      <p className="font-display text-[17px] leading-snug text-ink">{p.name}</p>
                      <p className="text-[13px] text-muted">{p.why}</p>
                    </div>
                    {s === 'done' ? (
                      <span className="shrink-0 text-sm text-gold-deep">On your wishlist ✓</span>
                    ) : (
                      <button onClick={() => void want(p)} disabled={s === 'saving'} className="min-h-11 shrink-0 px-1 text-sm text-oxblood underline underline-offset-4">
                        {s === 'error' ? 'Try again' : s === 'saving' ? 'Adding…' : 'Want this'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ))}
    </li>
  );
}
