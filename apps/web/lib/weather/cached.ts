import 'server-only';
import { cacheLife } from 'next/cache';
import { fetchCurrent, type Weather } from './current';

async function cachedWeather(lat: number, lon: number): Promise<Weather> {
  // Shared across instances, so a cold instance doesn't refetch what another already has.
  'use cache: remote';
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  const w = await fetchCurrent(lat, lon);
  if (!w) throw new Error('weather unavailable'); // thrown results aren't cached
  return w;
}

/** Current weather, shared for 15 minutes per location. Null when Open-Meteo fails. */
export async function getWeather(lat: number, lon: number): Promise<Weather | null> {
  try {
    return await cachedWeather(lat, lon);
  } catch {
    return null;
  }
}
