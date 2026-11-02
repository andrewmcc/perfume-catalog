import type { LondonNow } from '@perfume/core';
import type { Weather } from '@/lib/weather/current';

const clock = (h: number, m: number) => `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Monday · 7:40 pm · Late autumn · 9°C, rain" */
export function contextLine(now: LondonNow, weather: Weather | null): string {
  const parts = [now.weekday, clock(now.hour, now.minute), `${cap(now.phase)} ${now.season}`];
  if (weather) parts.push(`${weather.tempC}°C${weather.conditions ? `, ${weather.conditions}` : ''}`);
  return parts.join(' · ');
}
