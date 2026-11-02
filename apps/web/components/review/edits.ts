import type { PerfumeRead, ReadEdits } from '@perfume/core';

/** The read as the reviewer will approve it. */
export function applyEdits(read: PerfumeRead, e: ReadEdits | undefined): PerfumeRead {
  if (!e) return read;
  return {
    ...read,
    house: e.house !== undefined ? e.house : read.house,
    name: e.name !== undefined ? e.name : read.name,
    concentration: e.concentration !== undefined ? (e.concentration as PerfumeRead['concentration']) : read.concentration,
    flanker_or_edition: e.flanker !== undefined ? e.flanker : read.flanker_or_edition,
    size_ml: e.size_ml !== undefined ? e.size_ml : read.size_ml,
  };
}

export const CONCENTRATION_LABEL: Record<string, string> = {
  edc: 'Eau de cologne',
  edt: 'Eau de toilette',
  edp: 'Eau de parfum',
  parfum: 'Parfum',
  extrait: 'Extrait',
  cologne: 'Cologne',
  other: 'Other',
};
