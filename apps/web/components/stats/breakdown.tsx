import type { Count } from '@perfume/core';
import { familyColour } from '@/components/collection/family-colour';
import { label } from '@/components/collection/labels';

/**
 * One measure per category as thin horizontal bars in a single hue, each labelled with its count.
 * Family rows carry a swatch matching the diary marks; the label names it, so colour is never alone.
 */
export function Breakdown({ title, rows, swatch = false, raw = false }: { title: string; rows: Count[]; swatch?: boolean; raw?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return null;
  return (
    <section aria-label={title} className="label-card p-4">
      <h2 className="font-display text-lg italic">{title}</h2>
      <table className="mt-2 w-full border-separate border-spacing-y-[6px] text-sm">
        <thead className="sr-only">
          <tr>
            <th>{title.replace(/^By /, '')}</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} title={`${raw ? r.key : label(r.key)}: ${r.count}`}>
              <th scope="row" className="w-[38%] pr-2 text-left font-normal text-ink">
                <span className="flex items-center gap-1.5 truncate">
                  {swatch && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: familyColour(r.key === 'unknown' ? null : r.key) }} />}
                  {r.key === 'unknown' ? 'Not known' : raw ? r.key : label(r.key)}
                </span>
              </th>
              <td className="w-[52%]">
                <div className="h-2 rounded-r-[4px] bg-oxblood" style={{ width: `${(r.count / max) * 100}%`, minWidth: r.count ? 4 : 0 }} />
              </td>
              <td className="w-[10%] pl-2 text-right text-muted tabular-nums">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
