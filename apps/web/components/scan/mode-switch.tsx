'use client';

import type { Mode } from '@perfume/core';

const MODES: { id: Mode; label: string }[] = [
  { id: 'bottle', label: 'Bottle' },
  { id: 'samples', label: 'Samples' },
  { id: 'set', label: 'Set' },
];

/** Bottle · Samples · Set, in the engraved-label style over the camera. */
export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div role="radiogroup" aria-label="Scan mode" className="flex rounded-full border border-gold/40 bg-black/55 p-0.5 backdrop-blur">
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m.id)}
            className={`min-h-10 rounded-full px-4 font-display text-[15px] tracking-wide transition-colors ${
              active ? 'bg-paper text-oxblood italic' : 'text-paper/85'
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
