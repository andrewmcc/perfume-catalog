import type { BottleResult, ExtractionResult, Mode, PerfumeRead, SamplesResult, SetResult } from '@perfume/core';

const joinParts = (parts: (string | null)[]) => parts.filter(Boolean).join(' · ') || '(unnamed)';
const mark = (value: string | null, status: string) => (value && status === 'unclear' ? `${value}?` : value);
const perfumeLine = (p: PerfumeRead) =>
  joinParts([mark(p.house, p.status.house), mark(p.name, p.status.name), mark(p.concentration, p.status.concentration)]) +
  (p.identified_from === 'shape' ? ' (from branding)' : '');
const withAlternatives = (p: PerfumeRead) => [perfumeLine(p), ...(p.alternatives.length ? [`or: ${p.alternatives.join(', ')}`] : [])];

/** Short result lines for the Recent strip. "Not recognised" only when the mode's flag is false. */
export function summarise(mode: Mode, result: ExtractionResult): { recognised: boolean; lines: string[] } {
  if (mode === 'bottle') {
    const r = result as BottleResult;
    if (!r.is_perfume) return { recognised: false, lines: [] };
    return { recognised: true, lines: withAlternatives(r.perfume) };
  }
  if (mode === 'samples') {
    const r = result as SamplesResult;
    if (!r.is_perfume_photo) return { recognised: false, lines: [] };
    if (r.vials.length === 0) return { recognised: true, lines: [`No vial labels readable (${r.unreadable_count} unreadable)`] };
    const head = `${r.vials.length} ${r.vials.length === 1 ? "vial" : "vials"} read${r.unreadable_count ? `, ${r.unreadable_count} unreadable` : ''}`;
    return { recognised: true, lines: [head, ...r.vials.flatMap(withAlternatives)] };
  }
  const r = result as SetResult;
  if (!r.is_discovery_set) return { recognised: false, lines: [] };
  if (r.scents.length === 0) {
    return {
      recognised: true,
      lines: [`${r.set_house ?? '(unknown house)'} set · ${r.set_name ?? 'name not printed'} · no scent list visible — add the insert card or a photo of the open box`],
    };
  }
  return { recognised: true, lines: [joinParts([r.set_house, r.set_name]), ...r.scents.flatMap(withAlternatives)] };
}
