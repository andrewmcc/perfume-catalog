'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { label } from './labels';
import { editProposal, type Proposal } from './proposal';

type Status = 'owned' | 'wishlist';

const CONCENTRATIONS = ['', 'edt', 'edp', 'parfum', 'extrait', 'edc', 'cologne', 'other'] as const;
const field = 'min-h-11 w-full rounded-[3px] border border-line bg-card px-3 text-[16px] text-ink focus:border-oxblood focus:outline-none';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Something went wrong. Try again.');
  return json;
}

/** "Add without a photo": type a name, Claude says which perfume it is, check it, add it. */
export type Added = { perfumeId: string; itemId: string; house: string; name: string };

/**
 * `onAdded` replaces the default (open the perfume page); `trigger` and `initialText` let another
 * sheet open this one, e.g. the diary's "Not on your shelf? Add it".
 */
export function AddSheet({
  defaultStatus,
  onAdded,
  trigger = '+ Add',
  triggerClassName,
  initialText = '',
  ownedOnly = false,
}: {
  defaultStatus: Status;
  onAdded?: (a: Added) => void;
  trigger?: string;
  triggerClassName?: string;
  initialText?: string;
  ownedOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initialText);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setText(initialText);
    setProposal(null);
    setNotFound(false);
    setError(null);
  };
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await f();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const identify = () =>
    run(async () => {
      const { proposal: p } = await postJson<{ proposal: Proposal | null }>('/api/perfumes/identify', { text });
      setNotFound(!p);
      setProposal(p);
    });
  const typedAsIs = () => {
    // Not recognised: start from what they typed; they split it into house and name.
    setProposal({ house: text.trim(), name: '', concentration: null, flanker: null, perfumeId: null, onShelf: null });
    setNotFound(false);
  };
  const add = (status: Status) =>
    run(async () => {
      if (!proposal) return;
      const { perfumeId, itemId } = await postJson<{ perfumeId: string; itemId: string }>('/api/items/from-text', { ...proposal, status });
      close();
      if (onAdded) return onAdded({ perfumeId, itemId, house: proposal.house.trim(), name: proposal.name.trim() });
      router.push(`/collection/${perfumeId}`);
      router.refresh();
    });
  const edit = (k: 'house' | 'name' | 'concentration', v: string) => proposal && setProposal(editProposal(proposal, k, v));

  return (
    <>
      {triggerClassName ? (
        <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
          {trigger}
        </button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)} className="shrink-0 px-3">
          {trigger}
        </Button>
      )}
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Add without a photo" className="fixed inset-0 z-40 flex items-end bg-ink/40" onClick={close}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="label-card mx-auto max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-b-none px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <h2 className="font-display text-xl italic">Add without a photo</h2>
            {!proposal ? (
              <form
                className="mt-3 flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) void identify();
                }}
              >
                <label className="text-sm text-muted">
                  House and name
                  <input
                    autoFocus
                    value={text}
                    maxLength={120}
                    onChange={(e) => {
                      setText(e.target.value);
                      setNotFound(false);
                    }}
                    placeholder="e.g. Diptyque Philosykos"
                    className={`${field} mt-1`}
                  />
                </label>
                {notFound && (
                  <p className="text-sm text-ink">
                    Couldn’t tell which perfume that is.{' '}
                    <button type="button" onClick={typedAsIs} className="min-h-11 text-oxblood underline underline-offset-4">
                      Enter it yourself
                    </button>
                  </p>
                )}
                <Button type="submit" disabled={busy || !text.trim()}>
                  {busy ? 'Looking it up…' : 'Look it up'}
                </Button>
              </form>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <p className="w-fit rounded-full border border-line px-2 py-px text-[12px] text-muted italic">From text, not label</p>
                <label className="text-sm text-muted">
                  House
                  <input value={proposal.house} maxLength={80} onChange={(e) => edit('house', e.target.value)} className={`${field} mt-1`} />
                </label>
                <label className="text-sm text-muted">
                  Name
                  <input value={proposal.name} maxLength={80} onChange={(e) => edit('name', e.target.value)} className={`${field} mt-1`} />
                </label>
                <label className="text-sm text-muted">
                  Concentration
                  <select value={proposal.concentration ?? ''} onChange={(e) => edit('concentration', e.target.value)} className={`${field} mt-1`}>
                    {CONCENTRATIONS.map((c) => (
                      <option key={c} value={c}>
                        {c ? label(c) : 'Not sure'}
                      </option>
                    ))}
                  </select>
                </label>
                {proposal.flanker && <p className="text-sm text-muted">Edition: {proposal.flanker}</p>}
                {proposal.onShelf && <p className="text-sm text-ink">{proposal.onShelf === 'owned' ? 'Already on your shelf.' : 'Already on your wishlist.'}</p>}
                <div className="flex gap-2">
                  {(ownedOnly ? (['owned'] as const) : defaultStatus === 'wishlist' ? (['wishlist', 'owned'] as const) : (['owned', 'wishlist'] as const)).map((s, i) => (
                      <Button key={s} variant={i === 0 ? 'primary' : 'secondary'} disabled={busy || !proposal.house.trim() || !proposal.name.trim()} onClick={() => void add(s)} className="flex-1 px-3">
                        {s === 'wishlist' ? 'Add to wishlist' : 'I own it'}
                      </Button>
                    ))}
                </div>
                <button type="button" onClick={() => setProposal(null)} className="min-h-11 self-start text-sm text-muted underline underline-offset-4">
                  Start again
                </button>
              </div>
            )}
            {error && (
              <p role="status" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
