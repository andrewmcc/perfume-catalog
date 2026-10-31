import type { Mode } from './extract-schema';

const PREAMBLE = `You read perfume photos and fill in the schema from what is printed.
- Record perfume houses and names exactly as printed.
- Concentration only if printed (edc, edt, edp, parfum, extrait, cologne, other); otherwise "" with status "absent".
- Status "clear" when the text is plainly legible, "unclear" when it is printed but hard to read or ambiguous, "absent" when it is not there.
- size_ml is 0 when no size is printed.
- Never guess a name with nothing to go on: use "" with status "absent".`;

const BOTTLE = `${PREAMBLE}

These photos show one perfume bottle (photo 2, if present, is another angle or the box).
- When the label is partial, the bottle and cap shape may identify a well-known perfume; set identified_from to "label", "shape", "both" or "none" accordingly.
- format is full, travel, decant or sample.
- batch_code is the printed batch code, "" if none; other_text is any other relevant printed text.
- If the photo does not show a perfume, set is_perfume to false and leave the rest empty.`;

const SAMPLES = `${PREAMBLE}

These photos show a group of perfume sample vials.
- Return one entry in vials per vial, ordered left to right then top to bottom.
- A vial you cannot read at all is not an entry: count it in unreadable_count instead.
- If the photo does not show perfume vials, set is_perfume_photo to false with empty vials.`;

const SET = `${PREAMBLE}

These photos show a perfume discovery set (a box or card with several scents).
- Read the scent list from the box or the insert card; return one entry in scents per scent.
- set_house is the house selling the set; set_name is the set's name (status in status.set_name).
- A scent's house is "" unless it differs from set_house.
- If the photo does not show a discovery set, set is_discovery_set to false with empty scents.`;

export const PROMPTS: Record<Mode, string> = { bottle: BOTTLE, samples: SAMPLES, set: SET };
