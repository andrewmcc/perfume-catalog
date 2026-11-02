import { describe, expect, it } from 'vitest';
import { GeoUnavailableError } from '../geo';
import { resolveLocation } from '../location';

const found = async () => ({ lat: 51.50135, lon: -0.14189 });

describe('resolveLocation', () => {
  it('a postcode is looked up, rounded, and stored by outward code only', async () => {
    expect(await resolveLocation({ postcode: 'sw1a 1aa' }, found)).toEqual({ ok: true, lat: 51.5, lon: -0.14, place: 'SW1A' });
  });
  it('coordinates from the browser are rounded; place says so', async () => {
    expect(await resolveLocation({ lat: 53.48095, lon: -2.23743 }, found)).toEqual({ ok: true, lat: 53.48, lon: -2.24, place: 'Your location' });
  });
  it('bad input gives user-facing errors with a status', async () => {
    expect(await resolveLocation({ postcode: '12345' }, found)).toEqual({ ok: false, status: 400, error: "That doesn't look like a UK postcode." });
    expect(await resolveLocation({ postcode: 'ZZ1 1ZZ' }, async () => null)).toEqual({ ok: false, status: 404, error: 'Postcode not found.' });
    expect(await resolveLocation({ postcode: 'SW1A 1AA' }, async () => { throw new GeoUnavailableError(); })).toEqual({ ok: false, status: 503, error: 'Postcode lookup is unavailable. Try again later.' });
    expect(await resolveLocation({ lat: 91, lon: 0 }, found)).toMatchObject({ ok: false, status: 400 });
    expect(await resolveLocation({ lat: 'x', lon: 0 }, found)).toMatchObject({ ok: false, status: 400 });
    expect(await resolveLocation(null, found)).toMatchObject({ ok: false, status: 400 });
  });
});
