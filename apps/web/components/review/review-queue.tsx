'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@perfume/supabase';
import { approveInput, runBatch, type ReadEdits } from '@perfume/core';
import { Button } from '@/components/ui/button';
import type { QueueResult, QueueScan } from '@/lib/scans/queue';
import { BottleCard } from './bottle-card';
import { GroupCard } from './group-card';
import { PhotoViewer } from './photo-viewer';
import { ReadEditor } from './read-editor';
import { applyEdits } from './edits';

type SetFields = { set_house: string; set_name: string };
type Notice = { text: string; failures: string[] };

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

  const live = scans.filter((s) => !gone.has(s.id));
  const toReview = live.filter((s) => !s.couldntRead).map((s) => ({ scan: s, results: s.results.filter((r) => !gone.has(r.id)) })).filter((g) => g.results.length > 0);
  const couldntRead = live.filter((s) => s.couldntRead);
  const confident = toReview.flatMap((g) => g.results.filter((r) => r.flags.length === 0 && !unticked.has(r.id)).map((r) => ({ scan: g.scan, result: r })));
  const total = toReview.reduce((n, g) => n + g.results.length, 0) + couldntRead.length;

  const readOf = (r: QueueResult) => applyEdits(r.read, edits[r.id]);
  const setFieldsOf = (s: QueueScan): SetFields => setEditsByScan[s.id] ?? { set_house: s.set?.house ?? '', set_name: s.set?.name ?? '' };
  const markGone = (ids: string[]) => setGone((g) => new Set([...g, ...ids]));

  async function approve(scan: QueueScan, r: QueueResult) {
    const setFields = scan.mode === 'set' ? setFieldsOf(scan) : {};
    await post(`/api/scan-results/${r.id}/approve`, { input: approveInput(r.read, { ...edits[r.id], ...setFields }) });
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
                read={readOf(r)}
                busy={busy}
                onView={setViewing}
                onPickName={(name) => setEdits((e) => ({ ...e, [r.id]: { ...e[r.id], name } }))}
                onApprove={() => act(() => 'Approved.', () => one(() => approve(scan, r)))}
                onEdit={() => setEditing({ scan, result: r })}
                onDiscard={() => act(() => 'Discarded.', () => one(() => discard(r)))}
              />
            ))
          ) : (
            <GroupCard
              key={scan.id}
              scan={scan}
              results={results}
              readOf={readOf}
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.photos[0] ? <img src={s.photos[0]} alt="" className="h-16 w-16 shrink-0 rounded-[3px] object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-[3px] bg-line-soft" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] tracking-[0.14em] text-muted uppercase">{s.mode}</p>
                  <p className="text-sm break-words text-danger">{s.error ?? 'Nothing could be read from this photo.'}</p>
                  <div className="mt-1 flex gap-4">
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
          read={readOf(editing.result)}
          edits={edits[editing.result.id] ?? {}}
          bottle={editing.scan.bottle}
          onCancel={() => setEditing(null)}
          onSave={(e) => {
            setEdits((all) => ({ ...all, [editing.result.id]: e }));
            setEditing(null);
          }}
        />
      )}
      {viewing && <PhotoViewer src={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
