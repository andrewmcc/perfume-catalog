import Link from 'next/link';
import { addMonths, monthGrid, monthLabel } from '@perfume/core';
import { familyColour } from '@/components/collection/family-colour';
import type { DiaryWear } from '@/lib/wears/load';
import { BottleMark } from './bottle-mark';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Calendar grid for a month. Each worn day has a family-coloured bottle mark and a count when more than one. */
export function MonthView({ ym, wears, selected, today }: { ym: string; wears: DiaryWear[]; selected: string | null; today: string }) {
  const byDay = new Map<string, DiaryWear[]>();
  for (const w of wears) byDay.set(w.wornOn, [...(byDay.get(w.wornOn) ?? []), w]);
  const href = (m: string, d?: string) => `/diary?m=${m}${d ? `&d=${d}` : ''}`;

  return (
    <section aria-label={monthLabel(ym)}>
      <div className="flex items-center justify-between">
        <Link href={href(addMonths(ym, -1))} aria-label="Previous month" className="flex h-11 w-11 items-center justify-center text-2xl text-oxblood">
          ‹
        </Link>
        <h2 className="font-display text-xl italic">{monthLabel(ym)}</h2>
        <Link href={href(addMonths(ym, 1))} aria-label="Next month" className="flex h-11 w-11 items-center justify-center text-2xl text-oxblood">
          ›
        </Link>
      </div>
      <div className="label-card mt-2 p-2">
        <div className="grid grid-cols-7 text-center text-[11px] tracking-[0.14em] text-muted" aria-hidden="true">
          {DOW.map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {monthGrid(ym)
            .flat()
            .map(({ date, inMonth }) => {
              const day = byDay.get(date) ?? [];
              const n = Number(date.slice(8));
              if (!inMonth) return <span key={date} className="aspect-square p-1 text-center text-[13px] text-line" aria-hidden="true">{n}</span>;
              const isSel = date === selected;
              return (
                <Link
                  key={date}
                  href={href(ym, date)}
                  scroll={false}
                  aria-label={`${date}${day.length ? `, ${day.length === 1 ? '1 wear' : `${day.length} wears`}` : ''}`}
                  aria-current={isSel ? 'date' : undefined}
                  className={`flex aspect-square flex-col items-center justify-start gap-0.5 rounded-[3px] p-1 text-[13px] ${isSel ? 'bg-oxblood/10 ring-1 ring-oxblood' : ''}`}
                >
                  <span className={date === today ? 'rounded-full px-1.5 font-semibold text-oxblood ring-1 ring-gold-deep' : 'text-ink'}>{n}</span>
                  {day.length > 0 && (
                    <span className="flex items-center gap-0.5">
                      <BottleMark colour={familyColour(day[0]!.family)} />
                      {day.length > 1 && <span className="text-[10px] text-muted">{day.length}</span>}
                    </span>
                  )}
                </Link>
              );
            })}
        </div>
      </div>
    </section>
  );
}
