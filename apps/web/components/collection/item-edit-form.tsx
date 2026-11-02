'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import type { ItemDetail } from '@/lib/collection/perfume';
import { label } from './labels';

export type ItemPatch = Pick<ItemDetail, 'format' | 'size_ml' | 'purchase_price' | 'purchased_on' | 'purchase_source' | 'batch_code' | 'notes'>;
const num = (s: string) => {
  const n = Number(s);
  return s.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};

export function ItemEditForm({ item, busy, onSave, onCancel }: { item: ItemDetail; busy: boolean; onSave: (p: ItemPatch) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    format: item.format,
    size: item.size_ml?.toString() ?? '',
    price: item.purchase_price?.toString() ?? '',
    on: item.purchased_on ?? '',
    source: item.purchase_source ?? '',
    batch: item.batch_code ?? '',
    notes: item.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  function submit(e: FormEvent) {
    e.preventDefault();
    onSave({
      format: f.format,
      size_ml: num(f.size),
      purchase_price: num(f.price),
      purchased_on: f.on || null,
      purchase_source: f.source.trim() || null,
      batch_code: f.batch.trim() || null,
      notes: f.notes.trim() || null,
    });
  }
  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Format
        <select value={f.format} onChange={set('format')} className="min-h-11 rounded-[3px] border border-line bg-card px-3 text-[16px] text-ink focus:border-oxblood focus:outline-none">
          {['full', 'travel', 'decant', 'sample'].map((v) => (
            <option key={v} value={v}>
              {label(v)}
            </option>
          ))}
        </select>
      </label>
      <Field label="Size (ml)" inputMode="decimal" value={f.size} onChange={set('size')} />
      <Field label="Price paid (£)" inputMode="decimal" value={f.price} onChange={set('price')} />
      <Field label="Bought on" type="date" value={f.on} onChange={set('on')} />
      <Field label="Bought from" value={f.source} onChange={set('source')} />
      <Field label="Batch code" value={f.batch} onChange={set('batch')} />
      <Field label="Notes" value={f.notes} onChange={set('notes')} />
      <div className="flex gap-3">
        <Button type="submit" disabled={busy} className="flex-1">
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
