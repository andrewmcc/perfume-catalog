import { z } from 'zod';

// Structured outputs allow at most 16 union-typed parameters per schema, so nothing
// here is nullable: "" / 0 / [] are the "not printed" sentinels, normalised to null later.

export const Mode = z.enum(['bottle', 'samples', 'set']);
export type Mode = z.infer<typeof Mode>;

export const FieldStatus = z.enum(['clear', 'unclear', 'absent']);
export type FieldStatus = z.infer<typeof FieldStatus>;

export const Concentration = z.enum(['edc', 'edt', 'edp', 'parfum', 'extrait', 'cologne', 'other', '']);
export type Concentration = z.infer<typeof Concentration>;

export const IdentifiedFrom = z.enum(['label', 'shape', 'both', 'none']);
export type IdentifiedFrom = z.infer<typeof IdentifiedFrom>;

export const PerfumeReadSchema = z.object({
  house: z.string().describe('Perfume house; empty string if absent'),
  name: z.string().describe('Perfume name; empty string if absent'),
  concentration: Concentration.describe('Only if printed; empty string otherwise'),
  flanker_or_edition: z.string().describe('Flanker or edition text if printed; empty string otherwise'),
  size_ml: z.number().describe('Size in millilitres; 0 if not printed'),
  status: z.object({ house: FieldStatus, name: FieldStatus, concentration: FieldStatus }),
  alternatives: z.array(z.string()).describe('Up to 2 other likely full names when the name is truncated or partly hidden; [] otherwise'),
  identified_from: IdentifiedFrom,
});

export const BottleResultSchema = z.object({
  is_perfume: z.boolean(),
  perfume: PerfumeReadSchema,
  format: z.enum(['full', 'travel', 'decant', 'sample']),
  batch_code: z.string().describe('Batch code if printed; empty string otherwise'),
  other_text: z.string().describe('Any other relevant printed text; empty string if none'),
});

export const SamplesResultSchema = z.object({
  is_perfume_photo: z.boolean(),
  vials: z.array(PerfumeReadSchema),
  unreadable_count: z.number().int(),
});

export const SetResultSchema = z.object({
  is_discovery_set: z.boolean(),
  set_house: z.string(),
  set_name: z.string(),
  status: z.object({ set_name: FieldStatus }),
  scents: z.array(PerfumeReadSchema),
});

export const RESULT_SCHEMAS = { bottle: BottleResultSchema, samples: SamplesResultSchema, set: SetResultSchema } as const;

/** What Claude returns for a mode, before normalisation. */
export type RawResult<M extends Mode = Mode> = z.infer<(typeof RESULT_SCHEMAS)[M]>;
