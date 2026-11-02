import { fetchWithTimeout, type FetchFn } from '@/lib/settings/geo';

export type Weather = { tempC: number; conditions: string };

const WEATHER_TIMEOUT_MS = 5_000;

/** WMO weather code → a short word for the context line ('' when unknown). */
export function weatherText(code: number): string {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'storms';
  return '';
}

/** Current temperature and conditions from Open-Meteo. Never throws: any failure is null. */
export async function fetchCurrent(lat: number, lon: number, fetchFn: FetchFn = fetch, timeoutMs = WEATHER_TIMEOUT_MS): Promise<Weather | null> {
  const params = new URLSearchParams({ latitude: String(lat), longitude: String(lon), current: 'temperature_2m,weather_code', timezone: 'Europe/London' });
  try {
    const res = await fetchWithTimeout(fetchFn, `https://api.open-meteo.com/v1/forecast?${params}`, timeoutMs);
    if (!res.ok) return null;
    const json = (await res.json()) as { current?: { temperature_2m?: unknown; weather_code?: unknown } };
    const t = json.current?.temperature_2m;
    const code = json.current?.weather_code;
    if (typeof t !== 'number' || !Number.isFinite(t)) return null;
    return { tempC: Math.round(t), conditions: typeof code === 'number' ? weatherText(code) : '' };
  } catch {
    return null;
  }
}
