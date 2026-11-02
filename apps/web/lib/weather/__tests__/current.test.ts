import { describe, expect, it } from 'vitest';
import { fetchCurrent, weatherText } from '../current';

const res = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

describe('fetchCurrent', () => {
  it('parses temperature (rounded) and conditions', async () => {
    let url = '';
    const out = await fetchCurrent(51.5, -0.14, async (u) => {
      url = String(u);
      return res(200, { current: { temperature_2m: 9.4, weather_code: 61 } });
    });
    expect(out).toEqual({ tempC: 9, conditions: 'rain' });
    expect(url).toContain('latitude=51.5');
    expect(url).toContain('current=temperature_2m%2Cweather_code');
  });
  it('returns null on non-200, bad shape, throw or timeout', async () => {
    expect(await fetchCurrent(51.5, -0.14, async () => res(500))).toBeNull();
    expect(await fetchCurrent(51.5, -0.14, async () => res(200, { current: {} }))).toBeNull();
    expect(await fetchCurrent(51.5, -0.14, async () => { throw new Error('x'); })).toBeNull();
    expect(await fetchCurrent(51.5, -0.14, () => new Promise(() => {}), 20)).toBeNull();
  });
});

describe('weatherText', () => {
  it('maps WMO code bands', () => {
    expect([0, 1, 2, 3, 45, 48, 51, 63, 80, 71, 86, 95, 99].map(weatherText)).toEqual(['clear', 'clear', 'cloudy', 'cloudy', 'fog', 'fog', 'rain', 'rain', 'rain', 'snow', 'snow', 'storms', 'storms']);
    expect(weatherText(42)).toBe('');
  });
});
