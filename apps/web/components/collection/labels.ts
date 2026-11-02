const SPECIAL: Record<string, string> = {
  fougere: 'Fougère',
  evening_out: 'Evening out',
  very_long: 'Very long',
  full: 'Full bottle',
  edc: 'Eau de cologne',
  edt: 'Eau de toilette',
  edp: 'Eau de parfum',
};

/** Display label for a stored vocabulary value. */
export const label = (v: string): string => SPECIAL[v] ?? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ');

export const FILTER_TITLES = {
  family: 'Family',
  season: 'Season',
  time: 'Time of day',
  occasion: 'Occasion',
  house: 'House',
  format: 'Format',
  set: 'Set',
} as const;
