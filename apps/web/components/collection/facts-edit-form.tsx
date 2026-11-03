'use client';

import { useState, type FormEvent } from 'react';
import { FAMILIES, OCCASIONS, SEASONS, TIMES_OF_DAY, type FactField } from '@perfume/core';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { CONCENTRATION_LABEL } from '@/components/review/edits';
import { label } from './labels';

const LONGEVITY = ['short', 'moderate', 'long', 'very_long'];
const SILLAGE = ['intimate', 'moderate', 'strong', 'enormous'];
const LISTS = ['accords', 'notes_top', 'notes_heart', 'notes_base', 'perfumers'] as const;
const CHIPS = { seasons: SEASONS, times_of_day: TIMES_OF_DAY, occasions: OCCASIONS } as const;

const split = (s: string) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];

export type Identity = { house: string; name: string };

/** Edits the house, name and shown facts; the caller renames the perfume and turns facts into per-item overrides. */
export function FactsEditForm({
  identity,
  values,
  busy,
  onSave,
  onCancel,
}: {
  identity: Identity;
  values: Record<FactField, unknown>;
  busy: boolean;
  onSave: (edits: Record<FactField, unknown>, identity: Identity) => void;
  onCancel: () => void;
}) {
  const [who, setWho] = useState(identity);
  const str = (k: FactField) => (values[k] as string | null) ?? '';
  const [single, setSingle] = useState({ concentration: str('concentration'), family: str('family'), subfamily: str('subfamily'), longevity: str('longevity'), sillage: str('sillage'), flanker: str('flanker') });
  const [lists, setLists] = useState(Object.fromEntries(LISTS.map((k) => [k, ((values[k] as string[]) ?? []).join(', ')])) as Record<(typeof LISTS)[number], string>);
  const [chips, setChips] = useState(Object.fromEntries(Object.keys(CHIPS).map((k) => [k, (values[k as FactField] as string[]) ?? []])) as Record<keyof typeof CHIPS, string[]>);
  const [year, setYear] = useState(values.release_year ? String(values.release_year) : '');

  function submit(e: FormEvent) {
    e.preventDefault();
    const y = Number(year);
    if (!who.house.trim() || !who.name.trim()) return;
    onSave({
      ...Object.fromEntries(Object.entries(single).map(([k, v]) => [k, v.trim() || null])),
      ...Object.fromEntries(LISTS.map((k) => [k, split(lists[k])])),
      ...chips,
      release_year: year.trim() && Number.isInteger(y) && y > 1700 && y < 2100 ? y : null,
    } as Record<FactField, unknown>, { house: who.house.trim(), name: who.name.trim() });
  }

  const select = 'min-h-11 rounded-[3px] border border-line bg-card px-3 text-[16px] text-ink focus:border-oxblood focus:outline-none';
  const Select = ({ k, title, options, labels }: { k: keyof typeof single; title: string; options: readonly string[]; labels?: Record<string, string> }) => (
    <label className="flex flex-col gap-1.5 text-sm text-muted">
      {title}
      <select className={select} value={single[k]} onChange={(e) => setSingle((s) => ({ ...s, [k]: e.target.value }))}>
        <option value="">Unknown</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels?.[o] ?? label(o)}
          </option>
        ))}
      </select>
    </label>
  );
  const LIST_TITLES = { accords: 'Accords', notes_top: 'Top notes', notes_heart: 'Heart notes', notes_base: 'Base notes', perfumers: 'Perfumers' };
  const CHIP_TITLES = { seasons: 'Seasons', times_of_day: 'Time of day', occasions: 'Occasions' };

  return (
    <form onSubmit={submit} className="label-card mt-4 flex flex-col gap-3 p-4">
      <h2 className="font-display text-xl italic">Edit details</h2>
      <p className="text-sm text-muted">Your changes apply to your collection only.</p>
      <Field label="House" value={who.house} required maxLength={80} onChange={(e) => setWho((w) => ({ ...w, house: e.target.value }))} />
      <Field label="Name" value={who.name} required maxLength={80} onChange={(e) => setWho((w) => ({ ...w, name: e.target.value }))} />
      <Select k="concentration" title="Concentration" options={Object.keys(CONCENTRATION_LABEL)} labels={CONCENTRATION_LABEL} />
      <Field label="Flanker or edition" value={single.flanker} onChange={(e) => setSingle((s) => ({ ...s, flanker: e.target.value }))} />
      <Select k="family" title="Family" options={FAMILIES} />
      <Field label="Sub-family" value={single.subfamily} onChange={(e) => setSingle((s) => ({ ...s, subfamily: e.target.value }))} />
      {LISTS.map((k) => (
        <Field key={k} label={LIST_TITLES[k]} help="Separate with commas" value={lists[k]} onChange={(e) => setLists((l) => ({ ...l, [k]: e.target.value }))} />
      ))}
      <Select k="longevity" title="Longevity" options={LONGEVITY} />
      <Select k="sillage" title="Sillage" options={SILLAGE} />
      {(Object.keys(CHIPS) as (keyof typeof CHIPS)[]).map((k) => (
        <fieldset key={k}>
          <legend className="text-sm text-muted">{CHIP_TITLES[k]}</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {CHIPS[k].map((v) => {
              const on = chips[k].includes(v);
              return (
                <button
                  type="button"
                  key={v}
                  aria-pressed={on}
                  onClick={() => setChips((c) => ({ ...c, [k]: on ? c[k].filter((x) => x !== v) : [...c[k], v] }))}
                  className={`min-h-9 rounded-full border px-3 text-sm ${on ? 'border-oxblood bg-oxblood text-paper' : 'border-line text-ink'}`}
                >
                  {label(v)}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <Field label="Release year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
      <div className="mt-2 flex gap-3">
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
