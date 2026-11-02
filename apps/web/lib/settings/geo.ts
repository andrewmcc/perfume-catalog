// Postcode lookup (postcodes.io), from Seeds' lib/settings/geo.ts.
export class GeoUnavailableError extends Error {
  constructor(message = 'Postcode lookup unavailable') {
    super(message);
    this.name = 'GeoUnavailableError';
  }
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const POSTCODE_TIMEOUT_MS = 10_000;

/** Uppercase, no whitespace, a space before the last 3 characters; null if it isn't a UK postcode shape. */
export function normalizePostcode(input: string): string | null {
  const compact = input.toUpperCase().replace(/\s+/g, '');
  if (compact.length < 5) return null;
  const pc = `${compact.slice(0, -3)} ${compact.slice(-3)}`;
  return /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/.test(pc) ? pc : null;
}

/** "SW1A 1AA" → "SW1A": the only part of a postcode we store. */
export const outwardCode = (pc: string) => pc.split(' ')[0]!;

/** About 1 km: the only precision we store. */
export const roundCoord = (n: number) => Math.round(n * 100) / 100;

/** Rejects after `ms` even when the fetch implementation ignores the abort signal. */
export async function fetchWithTimeout(fetchFn: FetchFn, url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, ms);
  });
  try {
    return await Promise.race([fetchFn(url, { signal: controller.signal }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupPostcode(pc: string, fetchFn: FetchFn = fetch): Promise<{ lat: number; lon: number } | null> {
  let res: Response;
  try {
    res = await fetchWithTimeout(fetchFn, `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, POSTCODE_TIMEOUT_MS);
  } catch {
    throw new GeoUnavailableError();
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new GeoUnavailableError(`postcodes.io ${res.status}`);
  try {
    const json = (await res.json()) as { result?: { latitude?: number | null; longitude?: number | null } };
    const { latitude, longitude } = json.result ?? {};
    // Some valid postcodes (e.g. terminated ones) have no coordinates.
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
    return { lat: latitude, lon: longitude };
  } catch {
    throw new GeoUnavailableError();
  }
}
