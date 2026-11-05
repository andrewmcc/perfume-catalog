'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@perfume/supabase';
import { approveInput, runBatch, setHouseEdits, type PerfumeRead, type ReadEdits } from '@perfume/core';
import { Button } from '@/components/ui/button';
import type { QueueResult, QueueScan } from '@/lib/scans/queue';
import { BottleCard } from './bottle-card';
import { GroupCard } from './group-card';
import { PhotoViewer } from './photo-viewer';
import { ReadEditor } from './read-editor';
import { applyEdits } from './edits';
import { NoPhoto } from '@/components/ui/no-photo';

type SetFields = { set_house: string; set_name: string };
type Notice = { text: string; failures: string[] };

/** An empty read for typing a perfume in by hand; a set's vials start with the set's house. */
const blankRead = (house: string): PerfumeRead => ({
  house: house.trim() || null,
  name: null,
  concentration: null,
  flanker_or_edition: null,
  size_ml: null,
  status: { house: 'absent', name: 'absent', concentration: 'absent' },
  alternatives: [],
  identified_from: 'none',
});

async function post(url: string, body?: unknown): Promise<void> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `Request failed (${res.status})`);
  }
}

export function ReviewQueue({ scans }: { scans: QueueScan[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [edits, setEdits] = useState<Record<string, ReadEdits>>({});
  const [setEditsByScan, setSetEdits] = useState<Record<string, SetFields>>({});
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState<Set<string>>(new Set()); // result or scan ids handled this visit
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editing, setEditing] = useState<{ scan: QueueScan; result: QueueResult } | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [adding, setAdding] = useState<QueueScan | null>(null);

  const live = scans.filter((s) => !gone.has(s.id));
  const toReview = live.filter((s) => !s.couldntRead).map((s) => ({ scan: s, results: s.results.filter((r) => !gone.has(r.id)) })).filter((g) => g.results.length > 0);
  const couldntRead = live.filter((s) => s.couldntRead);
  const confident = toReview.flatMap((g) => g.results.filter((r) => r.flags.length === 0 && !unticked.has(r.id)).map((r) => ({ scan: g.scan, result: r })));
  const total = toReview.reduce((n, g) => n + g.results.length, 0) + couldntRead.length;

  const setFieldsOf = (s: QueueScan): SetFields => setEditsByScan[s.id] ?? { set_house: s.set?.house ?? '', set_name: s.set?.name ?? '' };
  // A set's vials with no house of their own take the set's house (as shown in its House field).
  const editsOf = (s: QueueScan, r: QueueResult): ReadEdits => (s.mode === 'set' ? setHouseEdits(r.read, edits[r.id] ?? {}, setFieldsOf(s).set_house) : (edits[r.id] ?? {}));
  const readOf = (s: QueueScan, r: QueueResult) => applyEdits(r.read, editsOf(s, r));
  const markGone = (ids: string[]) => setGone((g) => new Set([...g, ...ids]));

  async function approve(scan: QueueScan, r: QueueResult) {
    const setFields = scan.mode === 'set' ? setFieldsOf(scan) : {};
    await post(`/api/scan-results/${r.id}/approve`, { input: approveInput(r.read, { ...editsOf(scan, r), ...setFields }) });
    markGone([r.id]);
  }
  async function discard(r: QueueResult) {
    const { error } = await supabase.rpc('discard_result', { p_result_id: r.id });
    if (error) throw new Error(error.message);
    markGone([r.id]);
  }

  async function act(label: (okCount: number) => string, run: () => Promise<{ ok: unknown[]; failed: { error: string }[] }>) {
    setBusy(true);
    setNotice(null);
    try {
      const out = await run();
      setNotice({ text: label(out.ok.length), failures: out.failed.map((f) => f.error) });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }
  const one = (fn: () => Promise<void>) => runBatch([0], fn);

  const approveConfident = () => act((n) => `Approved ${n}.`, () => runBatch(confident, ({ scan, result }) => approve(scan, result)));
  const approveGroup = (scan: QueueScan, results: QueueResult[]) =>
    act(
      (n) => `Done: ${n} of ${results.length}.`,
      () => runBatch(results, (r) => (unticked.has(r.id) ? discard(r) : approve(scan, r))),
    );
  // Typed by hand: works with no AI credits. Bottle format and batch ride along as edits for approval.
  const addManual = (scan: QueueScan, e: ReadEdits) =>
    act(
      () => 'Added. Check it, then approve.',
      () =>
        one(async () => {
          const { house, name, concentration, flanker, size_ml, format, batch_code } = e;
          const { data, error } = await supabase.rpc('add_manual_result', { p_scan_id: scan.id, p_input: { house, name, concentration, flanker, size_ml } });
          if (error) throw new Error(error.message);
          if (scan.mode === 'bottle') setEdits((all) => ({ ...all, [data]: { format, batch_code } }));
        }),
    );
  const dismiss = (scan: QueueScan) =>
    act(
      () => 'Dismissed.',
      () =>
        one(async () => {
          const { error } = await supabase.rpc('dismiss_scan', { p_scan_id: scan.id });
          if (error) throw new Error(error.message);
          markGone([scan.id]);
        }),
    );
  const readAgain = (scan: QueueScan) =>
    act(
      () => 'Reading again. It will be back here shortly.',
      () =>
        one(async () => {
          await post(`/api/scans/${scan.id}/extract`);
          markGone([scan.id]);
        }),
    );

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl italic">Review</h1>
        <p className="text-sm text-muted">{total === 0 ? 'All caught up' : `${total} to review`}</p>
      </div>

      {confident.length > 0 && (
        <Button onClick={approveConfident} disabled={busy} className="mt-4 w-full">
          Approve {confident.length} confident
        </Button>
      )}

      {notice && (
        <div role="status" className="mt-3 text-sm text-ink">
          {notice.text}
          {notice.failures.length > 0 && (
            <ul className="mt-1 text-danger">
              {notice.failures.map((f, i) => (
                <li key={i}>Not approved: {f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {total === 0 && <p className="mt-6 text-muted">Nothing waiting. Scan more bottles from the icon at the top.</p>}

      <div className="mt-5 flex flex-col gap-4">
        {toReview.map(({ scan, results }) =>
          scan.mode === 'bottle' ? (
            results.map((r) => (
              <BottleCard
                key={r.id}
                photo={scan.photos[0]}
                result={r}
                read={readOf(scan, r)}
                busy={busy}
                onView={setViewing}
                onPickName={(name) => setEdits((e) => ({ ...e, [r.id]: { ...e[r.id], name } }))}
                onApprove={() => act(() => 'Approved.', () => one(() => approve(scan, r)))}
                onEdit={() => setEditing({ scan, result: r })}
                onDiscard={() => act(() => 'Discarded.', () => one(() => discard(r)))}
                wishlist={edits[r.id]?.status === 'wishlist'}
                onWishlist={(on) => setEdits((e) => ({ ...e, [r.id]: { ...e[r.id], status: on ? 'wishlist' : undefined } }))}
              />
            ))
          ) : (
            <GroupCard
              key={scan.id}
              scan={scan}
              results={results}
              readOf={(r) => readOf(scan, r)}
              ticked={(id) => !unticked.has(id)}
              setFields={scan.mode === 'set' ? setFieldsOf(scan) : null}
              busy={busy}
              onView={setViewing}
              onToggle={(id) =>
                setUnticked((u) => {
                  const next = new Set(u);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onEdit={(r) => setEditing({ scan, result: r })}
              onSetField={(k, v) => setSetEdits((e) => ({ ...e, [scan.id]: { ...setFieldsOf(scan), [k]: v } }))}
              onApprove={() => approveGroup(scan, results)}
              onDismiss={() => dismiss(scan)}
              onAdd={() => setAdding(scan)}
            />
          ),
        )}
      </div>

      {couldntRead.length > 0 && (
        <section className="mt-6" aria-label="Couldn’t read">
          <h2 className="py-2 text-sm text-muted">Couldn’t read ({couldntRead.length})</h2>
          <ul className="flex flex-col gap-3">
            {couldntRead.map((s) => (
              <li key={s.id} className="label-card flex gap-3 p-3">
                {s.photos.length > 0 ? (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {s.photos.map(({ src, full }, i) => (
                      <button key={full} onClick={() => setViewing(full)} aria-label={`View photo ${i + 1}`} className="press">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" loading="lazy" decoding="async" className="h-16 w-16 rounded-[3px] object-cover" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <NoPhoto className="h-16 w-16" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] tracking-[0.14em] text-muted uppercase">{s.mode}</p>
                  <p className="text-sm break-words text-danger">{s.error ?? 'Nothing could be read from this photo.'}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4">
                    <button onClick={() => setAdding(s)} disabled={busy} className="min-h-11 text-sm text-oxblood underline underline-offset-4">
                      {s.mode === 'bottle' ? 'Type it in' : 'Add a scent'}
                    </button>
                    <button onClick={() => readAgain(s)} disabled={busy} className="min-h-11 text-sm text-oxblood underline underline-offset-4">
                      Read again
                    </button>
                    <button onClick={() => dismiss(s)} disabled={busy} className="min-h-11 text-sm text-muted underline underline-offset-4">
                      Dismiss
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <ReadEditor
          read={readOf(editing.scan, editing.result)}
          edits={edits[editing.result.id] ?? {}}
          bottle={editing.scan.bottle}
          onCancel={() => setEditing(null)}
          onSave={(e) => {
            setEdits((all) => ({ ...all, [editing.result.id]: e }));
            setEditing(null);
          }}
        />
      )}
      {adding && (
        <ReadEditor
          title={adding.mode === 'bottle' ? 'Type it in' : 'Add a scent'}
          read={blankRead(adding.mode === 'set' ? setFieldsOf(adding).set_house : '')}
          edits={{}}
          bottle={adding.bottle}
          onCancel={() => setAdding(null)}
          onSave={(e) => {
            const scan = adding;
            setAdding(null);
            void addManual(scan, e);
          }}
        />
      )}
      {viewing && <PhotoViewer src={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
