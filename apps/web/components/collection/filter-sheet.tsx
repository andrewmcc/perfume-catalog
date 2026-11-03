'use client';

import type { FilterKey, Filters, filterOptions } from '@perfume/core';
import { Button } from '@/components/ui/button';
import { FILTER_TITLES, filterValueLabel } from './labels';
import { Sheet } from '@/components/ui/sheet';

type Options = ReturnType<typeof filterOptions>;

/** Bottom sheet of filter chips; only values present in the collection are offered. */
export function FilterSheet({ options, filters, onChange, onClose }: { options: Options; filters: Filters; onChange: (f: Filters) => void; onClose: () => void }) {
  const toggle = (k: FilterKey, v: string) => {
    const cur = filters[k] ?? [];
    onChange({ ...filters, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  };
  const groups = (Object.keys(FILTER_TITLES) as FilterKey[])
    .map((k) => ({ k, values: k === 'set' ? options.set.map((s) => ({ v: s.id, l: s.name })) : options[k].map((v) => ({ v, l: filterValueLabel(k, v) })) }))
    .filter((g) => g.values.length > 0);
  return (
    <Sheet label="Filters" onClose={onClose}>
        <h2 className="font-display text-xl italic">Filters</h2>
        {groups.length === 0 && <p className="mt-3 text-sm text-muted">Nothing to filter by yet.</p>}
        {groups.map(({ k, values }) => (
          <fieldset key={k} className="mt-4">
            <legend className="text-[12px] tracking-[0.14em] text-muted uppercase">{FILTER_TITLES[k]}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {values.map(({ v, l }) => {
                const on = filters[k]?.includes(v) ?? false;
                return (
                  <button
                    key={v}
                    aria-pressed={on}
                    onClick={() => toggle(k, v)}
                    className={`min-h-9 rounded-full border px-3 text-sm ${on ? 'border-oxblood bg-oxblood text-paper' : 'border-line text-ink hover:border-oxblood'}`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="mt-6 flex gap-3">
          <Button onClick={onClose} className="flex-1">
            Done
          </Button>
          <Button variant="secondary" onClick={() => onChange({})}>
            Clear
          </Button>
        </div>
    </Sheet>
  );
}
