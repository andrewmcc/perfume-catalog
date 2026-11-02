/** Diary mark colour per scent family: cool for fresh families, warm for heavy ones. */
export const FAMILY_COLOUR: Record<string, string> = {
  citrus: '#d9b24a',
  aquatic: '#6f8e96',
  green: '#7d8b5e',
  aromatic: '#8f9a6e',
  fougere: '#8a7f5a',
  floral: '#c98a8a',
  fruity: '#d99a6c',
  chypre: '#7b6a4f',
  musky: '#b9a28c',
  woody: '#7a5236',
  spicy: '#b0543a',
  gourmand: '#a0643c',
  oriental: '#8e3b2e',
  leather: '#4a2c22',
};
export const NO_FAMILY_COLOUR = '#a08a76';
export const familyColour = (f: string | null | undefined) => (f && FAMILY_COLOUR[f]) || NO_FAMILY_COLOUR;
