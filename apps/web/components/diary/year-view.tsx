import Link from 'next/link';
import { heatLevel, monthLabel, yearGrid } from '@perfume/core';

/** Heat steps for 1, 2 and 3+ wears (one oxblood hue, light → dark; validated on the card surface). */
export const HEAT = ['', '#D9A397', '#A44E47', '#5A1F1F'] as const;

const wearsLabel = (n: number) => (n === 1 ? '1 wear' : `${n} wears`);

/** Twelve small months; each day shaded by how many wears it has and linking to that day. */
export function YearView({ year, counts, today }: { year: number; counts: Map<string, number>; today: string }) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return (
    <section aria-label={`${year}`}>
      <div className="flex items-center justify-between">
        {year > 2000 ? (
          <Link href={`/diary?y=${year - 1}`} aria-label="Previous year" className="flex h-11 w-11 items-center justify-center text-2xl text-oxblood">
            ‹
          </Link>
        ) : (
          <span className="h-11 w-11" />
        )}
        <h2 className="font-display text-xl italic">{year}</h2>
        {year < 2100 ? (
          <Link href={`/diary?y=${year + 1}`} aria-label="Next year" className="flex h-11 w-11 items-center justify-center text-2xl text-oxblood">
            ›
          </Link>
        ) : (
          <span className="h-11 w-11" />
        )}
      </div>
      <p className="text-center text-sm text-muted">{total === 0 ? `No wears logged in ${year}.` : `${wearsLabel(total)} in ${year}`}</p>
      <div className="label-card mt-2 grid grid-cols-3 gap-x-3 gap-y-4 p-3">
        {yearGrid(year).map(({ ym, weeks }) => (
          <div key={ym}>
            <Link href={`/diary?m=${ym}`} className="flex min-h-9 items-center text-[12px] tracking-[0.12em] text-ink uppercase underline-offset-4 hover:underline">
              {monthLabel(ym).slice(0, 3)}
            </Link>
            <div className="grid grid-cols-7 gap-[2px]">
              {weeks.flat().map((date, i) => {
                if (!date) return <span key={i} aria-hidden="true" className="aspect-square" />;
                const n = counts.get(date) ?? 0;
                const level = heatLevel(n);
                return (
                  <Link
                    key={date}
                    href={`/diary?d=${date}`}
                    aria-label={`${date}: ${n === 0 ? 'no wears' : wearsLabel(n)}`}
                    title={`${date}: ${n === 0 ? 'no wears' : wearsLabel(n)}`}
                    className={`aspect-square rounded-[2px] ${level === 0 ? 'bg-line-soft/50' : ''} ${date === today ? 'outline outline-1 outline-offset-[1px] outline-ink' : ''}`}
                    style={level ? { backgroundColor: HEAT[level] } : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[12px] text-muted" aria-label="Legend: lighter is fewer wears, darker is more">
        Less
        <span className="size-3 rounded-[2px] bg-line-soft/50" />
        {HEAT.slice(1).map((c) => (
          <span key={c} className="size-3 rounded-[2px]" style={{ backgroundColor: c }} />
        ))}
        More
      </div>
    </section>
  );
}
