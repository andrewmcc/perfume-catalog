import { z } from 'zod';

// Shared vocabularies: enrichment enums and the collection's filter options.
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export const TIMES_OF_DAY = ['day', 'evening', 'night'] as const;
export const OCCASIONS = ['office', 'casual', 'date', 'evening_out', 'formal', 'gym', 'holiday'] as const;
export const FAMILIES = ['citrus', 'floral', 'fruity', 'green', 'aquatic', 'aromatic', 'chypre', 'fougere', 'gourmand', 'oriental', 'spicy', 'woody', 'leather', 'musky'] as const;

// No nullables (16-union limit): "" / 0 / [] / 'unknown' are the "don't know" sentinels.
export const PerfumeSuggestionSchema = z.object({
  perfumers: z.array(z.string()).describe('Perfumer(s); [] if unknown'),
  release_year: z.number().int().describe('Year first released; 0 if unknown'),
  house_type: z.enum(['designer', 'niche', 'indie', 'celebrity', 'other', '']),
  family: z.enum([...FAMILIES, '']).describe('Main scent family'),
  subfamily: z.string().describe('Short sub-family, e.g. "Aromatic fougère"; empty string if unsure'),
  accords: z.array(z.string()).describe('Main accords, most prominent first, at most 6'),
  notes_top: z.array(z.string()),
  notes_heart: z.array(z.string()),
  notes_base: z.array(z.string()),
  longevity: z.enum(['short', 'moderate', 'long', 'very_long', '']),
  sillage: z.enum(['intimate', 'moderate', 'strong', 'enormous', '']),
  seasons: z.array(z.enum(SEASONS)),
  times_of_day: z.array(z.enum(TIMES_OF_DAY)),
  occasions: z.array(z.enum(OCCASIONS)),
  gender_marketing: z.enum(['feminine', 'masculine', 'unisex', '']),
  discontinued: z.enum(['yes', 'no', 'unknown']),
  typical_price_per_ml: z.number().describe('Typical UK retail price per ml in GBP for this concentration; 0 if unknown'),
});
export type RawSuggestion = z.infer<typeof PerfumeSuggestionSchema>;
