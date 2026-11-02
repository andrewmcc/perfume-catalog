import { GeoUnavailableError, lookupPostcode, normalizePostcode, outwardCode, roundCoord } from './geo';

type Lookup = typeof lookupPostcode;
export type Resolved = { ok: true; lat: number; lon: number; place: string } | { ok: false; status: number; error: string };

const bad = (error: string, status = 400): Resolved => ({ ok: false, status, error });

/** Turns `{ postcode }` or `{ lat, lon }` into the rounded coordinates and place we store. */
export async function resolveLocation(body: unknown, lookup: Lookup = lookupPostcode): Promise<Resolved> {
  if (!body || typeof body !== 'object') return bad('Send a postcode or a location.');
  const b = body as { postcode?: unknown; lat?: unknown; lon?: unknown };
  if (typeof b.postcode === 'string') {
    const pc = normalizePostcode(b.postcode);
    if (!pc) return bad("That doesn't look like a UK postcode.");
    try {
      const at = await lookup(pc);
      if (!at) return bad('Postcode not found.', 404);
      return { ok: true, lat: roundCoord(at.lat), lon: roundCoord(at.lon), place: outwardCode(pc) };
    } catch (e) {
      if (e instanceof GeoUnavailableError) return bad('Postcode lookup is unavailable. Try again later.', 503);
      throw e;
    }
  }
  const { lat, lon } = b;
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return bad('That location is not valid.');
  return { ok: true, lat: roundCoord(lat), lon: roundCoord(lon), place: 'Your location' };
}
