import type { BottleResult, Mode, PerfumeRead, SamplesResult, SetResult } from './extract-schema';

const joinParts = (parts: string[]) => parts.filter(Boolean).join(' · ') || '(unnamed)';
const mark = (value: string, status: string) => (value && status === 'unclear' ? `${value}?` : value);
const perfumeLine = (p: PerfumeRead) =>
  joinParts([mark(p.house, p.status.house), mark(p.name, p.status.name), mark(p.concentration, p.status.concentration)]);
const statuses = (p: PerfumeRead) => `house ${p.status.house}, name ${p.status.name}, conc ${p.status.concentration}`;

/** "Nothing recognised" (recognised: false) only when the mode's flag is false; otherwise show what was read. */
export function summarise(
  mode: Mode,
  result: BottleResult | SamplesResult | SetResult,
): { recognised: boolean; lines: string[] } {
  if (mode === 'bottle') {
    const r = result as BottleResult;
    if (!r.is_perfume) return { recognised: false, lines: [] };
    const first = perfumeLine(r.perfume) + (r.identified_from === 'shape' ? ' (from branding)' : '');
    return { recognised: true, lines: [first, statuses(r.perfume)] };
  }
  if (mode === 'samples') {
    const r = result as SamplesResult;
    if (!r.is_perfume_photo) return { recognised: false, lines: [] };
    if (r.vials.length === 0) {
      return { recognised: true, lines: [`No vial labels readable (${r.unreadable_count} unreadable)`] };
    }
    return {
      recognised: true,
      lines: [
        `${r.vials.length} vials read, ${r.unreadable_count} unreadable`,
        ...r.vials.map((v) => `${perfumeLine(v)} (${statuses(v)})`),
      ],
    };
  }
  const r = result as SetResult;
  if (!r.is_discovery_set) return { recognised: false, lines: [] };
  if (r.scents.length === 0) {
    return {
      recognised: true,
      lines: [
        `${r.set_house || '(unknown house)'} set · ${r.set_name || 'name not printed'} · no scent list visible — add the insert card or a photo of the open box`,
      ],
    };
  }
  return {
    recognised: true,
    lines: [joinParts([r.set_house, r.set_name]), ...r.scents.map((s) => `${perfumeLine(s)} (${statuses(s)})`)],
  };
}
