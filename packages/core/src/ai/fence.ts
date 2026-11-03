/** Text placed inside a prompt as data: no angle brackets, one line, at most `max` characters. */
export const fence = (s: string | null | undefined, max = 100): string =>
  (s ?? '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

/** A model-written line we show: trimmed, 1–max characters, no newline; else null. */
export function oneLine(s: string, max = 70): string | null {
  const t = s.trim();
  return t && t.length <= max && !/[\r\n]/.test(t) ? t : null;
}
