import { FLAG_COPY, type Flag } from '@perfume/core';

export function FlagChips({ flags }: { flags: Flag[] }) {
  if (!flags.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Needs a look">
      {flags.map((f) => (
        <li key={f} className="rounded-full border border-rose/70 bg-rose/10 px-2 py-0.5 text-[12px] text-oxblood">
          {FLAG_COPY[f]}
        </li>
      ))}
    </ul>
  );
}
