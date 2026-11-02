import { describe, expect, it } from 'vitest';
import { GeoUnavailableError, lookupPostcode, normalizePostcode, outwardCode, roundCoord } from '../geo';

const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe('postcodes', () => {
  it('normalises UK postcodes and rejects other shapes', () => {
    expect(normalizePostcode('sw1a1aa')).toBe('SW1A 1AA');
    expect(normalizePostcode(' m1  1ae ')).toBe('M1 1AE');
    expect(normalizePostcode('12345')).toBeNull();
  });
  it('takes the outward code', () => expect(outwardCode('SW1A 1AA')).toBe('SW1A'));
  it('rounds coordinates to 2 dp', () => expect(roundCoord(51.50135)).toBe(51.5));
  it('lookup: 404 is null, coordinates are returned, network errors throw GeoUnavailableError', async () => {
    expect(await lookupPostcode('ZZ1 1ZZ', async () => res(404))).toBeNull();
    expect(await lookupPostcode('SW1A 1AA', async () => res(200, { result: { latitude: 51.501, longitude: -0.141 } }))).toEqual({ lat: 51.501, lon: -0.141 });
    await expect(lookupPostcode('SW1A 1AA', async () => { throw new Error('down'); })).rejects.toBeInstanceOf(GeoUnavailableError);
    await expect(lookupPostcode('SW1A 1AA', async () => res(500))).rejects.toBeInstanceOf(GeoUnavailableError);
  });
});
