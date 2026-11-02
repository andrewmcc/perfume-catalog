import type { z } from 'zod';
import { RESULT_SCHEMAS, type Concentration, type FieldStatus, type IdentifiedFrom, type Mode, type PerfumeReadSchema } from './schema.js';

export type PerfumeRead = {
  house: string | null;
  name: string | null;
  concentration: Exclude<Concentration, ''> | null;
  flanker_or_edition: string | null;
  size_ml: number | null;
  status: { house: FieldStatus; name: FieldStatus; concentration: FieldStatus };
  alternatives: string[];
  identified_from: IdentifiedFrom;
};
export type BottleResult = {
  is_perfume: boolean;
  perfume: PerfumeRead;
  format: 'full' | 'travel' | 'decant' | 'sample';
  batch_code: string | null;
  other_text: string | null;
};
export type SamplesResult = { is_perfume_photo: boolean; vials: PerfumeRead[]; unreadable_count: number };
export type SetResult = {
  is_discovery_set: boolean;
  set_house: string | null;
  set_name: string | null;
  status: { set_name: FieldStatus };
  scents: PerfumeRead[];
};
export type ExtractionResult = BottleResult | SamplesResult | SetResult;

const text = (v: string): string | null => (v.trim() === '' ? null : v.trim());

function normalizeRead(r: z.infer<typeof PerfumeReadSchema>): PerfumeRead {
  return {
    house: text(r.house),
    name: text(r.name),
    concentration: r.concentration === '' ? null : r.concentration,
    flanker_or_edition: text(r.flanker_or_edition),
    size_ml: r.size_ml > 0 ? r.size_ml : null,
    status: r.status,
    alternatives: r.alternatives.map((a) => a.trim()).filter(Boolean).slice(0, 2),
    identified_from: r.identified_from,
  };
}
/** Validates Claude's output against the mode's schema and turns sentinels into null. Throws if it doesn't match. */
export function normalizeResult(mode: Mode, raw: unknown): ExtractionResult {
  switch (mode) {
    case 'bottle': {
      const r = RESULT_SCHEMAS.bottle.parse(raw);
      return { is_perfume: r.is_perfume, perfume: normalizeRead(r.perfume), format: r.format, batch_code: text(r.batch_code), other_text: text(r.other_text) };
    }
    case 'samples': {
      const r = RESULT_SCHEMAS.samples.parse(raw);
      return { is_perfume_photo: r.is_perfume_photo, vials: r.vials.map(normalizeRead), unreadable_count: r.unreadable_count };
    }
    case 'set': {
      const r = RESULT_SCHEMAS.set.parse(raw);
      return { is_discovery_set: r.is_discovery_set, set_house: text(r.set_house), set_name: text(r.set_name), status: r.status, scents: r.scents.map(normalizeRead) };
    }
  }
}
