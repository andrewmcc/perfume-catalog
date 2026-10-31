import { z } from 'zod';

// Structured outputs allow at most 16 union-typed parameters per schema, so
// nothing here is nullable: "" / 0 are the "not printed" sentinels.

export const Mode = z.enum(['bottle', 'samples', 'set']);
export type Mode = z.infer<typeof Mode>;

export const FieldStatus = z.enum(['clear', 'unclear', 'absent']);
export type FieldStatus = z.infer<typeof FieldStatus>;

export const Concentration = z.enum(['edc', 'edt', 'edp', 'parfum', 'extrait', 'cologne', 'other', '']);
export type Concentration = z.infer<typeof Concentration>;

export const PerfumeRead = z.object({
  house: z.string().describe('Perfume house exactly as printed; empty string if absent'),
  name: z.string().describe('Perfume name exactly as printed; empty string if absent'),
  concentration: Concentration.describe('Only if printed; empty string otherwise'),
  flanker_or_edition: z.string().describe('Flanker or edition text if printed; empty string otherwise'),
  size_ml: z.number().describe('Size in millilitres; 0 if not printed'),
  status: z.object({ house: FieldStatus, name: FieldStatus, concentration: FieldStatus }),
});
export type PerfumeRead = z.infer<typeof PerfumeRead>;

export const BottleResult = z.object({
  is_perfume: z.boolean(),
  perfume: PerfumeRead,
  format: z.enum(['full', 'travel', 'decant', 'sample']),
  batch_code: z.string().describe('Batch code if printed; empty string otherwise'),
  identified_from: z.enum(['label', 'shape', 'both', 'none']),
  other_text: z.string().describe('Any other relevant printed text; empty string if none'),
});
export type BottleResult = z.infer<typeof BottleResult>;

export const SamplesResult = z.object({
  is_perfume_photo: z.boolean(),
  vials: z.array(PerfumeRead),
  unreadable_count: z.number().int(),
});
export type SamplesResult = z.infer<typeof SamplesResult>;

export const SetResult = z.object({
  is_discovery_set: z.boolean(),
  set_house: z.string(),
  set_name: z.string(),
  status: z.object({ set_name: FieldStatus }),
  scents: z.array(PerfumeRead),
});
export type SetResult = z.infer<typeof SetResult>;

export const RESULT_SCHEMAS = { bottle: BottleResult, samples: SamplesResult, set: SetResult } as const;
