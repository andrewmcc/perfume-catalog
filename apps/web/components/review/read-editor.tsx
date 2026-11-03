'use client';

import { useState, type FormEvent } from 'react';
import type { PerfumeRead, ReadEdits } from '@perfume/core';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { CONCENTRATION_LABEL } from './edits';
import { Sheet } from '@/components/ui/sheet';

const FORMATS = { full: 'Full bottle', travel: 'Travel', decant: 'Decant', sample: 'Sample' } as const;

/** Bottom sheet for correcting one read before approving it. */
export function ReadEditor({
  read,
  edits,
  bottle,
  onSave,
  onCancel,
}: {
  read: PerfumeRead;
  edits: ReadEdits;
  bottle: { format: string; batch_code: string | null } | null;
  onSave: (e: ReadEdits) => void;
  onCancel: () => void;
}) {
  const [house, setHouse] = useState(read.house ?? '');
  const [name, setName] = useState(read.name ?? '');
  const [conc, setConc] = useState(read.concentration ?? '');
  const [flanker, setFlanker] = useState(read.flanker_or_edition ?? '');
  const [size, setSize] = useState(read.size_ml?.toString() ?? '');
  const [format, setFormat] = useState(edits.format ?? bottle?.format ?? 'full');
  const [batch, setBatch] = useState(edits.batch_code ?? bottle?.batch_code ?? '');
  const missing = !house.trim() || !name.trim();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (missing) return;
    const sizeNum = size.trim() === '' ? null : Number(size);
    onSave({
      ...edits,
      house: house.trim(),
      name: name.trim(),
      concentration: conc || null,
      flanker: flanker.trim() || null,
      size_ml: sizeNum !== null && Number.isFinite(sizeNum) && sizeNum > 0 ? sizeNum : null,
      ...(bottle ? { format, batch_code: batch.trim() || null } : {}),
    });
  }

  const select = 'min-h-11 rounded-[3px] border border-line bg-card px-3 text-[16px] text-ink focus:border-oxblood focus:outline-none';
  return (
    <Sheet label="Edit details" onClose={onCancel}>
      <form onSubmit={submit}>
        <h2 className="font-display text-xl italic">Edit details</h2>
        <div className="mt-4 flex flex-col gap-3">
          <Field label="House" value={house} onChange={(e) => setHouse(e.target.value)} hint={!house.trim() ? 'Needed' : undefined} />
          <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} hint={!name.trim() ? 'Needed' : undefined} />
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            Concentration
            <select className={select} value={conc} onChange={(e) => setConc(e.target.value)}>
              <option value="">Not shown</option>
              {Object.entries(CONCENTRATION_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Field label="Flanker or edition" value={flanker} onChange={(e) => setFlanker(e.target.value)} />
          <Field label="Size (ml)" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} />
          {bottle && (
            <>
              <label className="flex flex-col gap-1.5 text-sm text-muted">
                Format
                <select className={select} value={format} onChange={(e) => setFormat(e.target.value)}>
                  {Object.entries(FORMATS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Batch code" value={batch} onChange={(e) => setBatch(e.target.value)} />
            </>
          )}
        </div>
        <div className="mt-5 flex gap-3">
          <Button type="submit" disabled={missing} className="flex-1">
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
