'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

/** Postcode or browser location for Today's weather. Only approximate coordinates are stored. */
export function LocationForm({ place }: { place: string | null }) {
  const router = useRouter();
  const [postcode, setPostcode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: 'POST' | 'DELETE', body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/location', { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      setPostcode('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function useMine() {
    if (!navigator.geolocation) return setError('This browser can’t share its location. Enter a postcode instead.');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => void send('POST', { lat: p.coords.latitude, lon: p.coords.longitude }),
      () => {
        setBusy(false);
        setError('Location wasn’t shared. Enter a postcode instead.');
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 3_600_000 },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] text-ink">{place ? `Weather for ${place}` : 'No location set. Today uses the season and time of day only.'}</p>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send('POST', { postcode });
        }}
      >
        <Field label="UK postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} autoComplete="postal-code" placeholder="SW1A 1AA" className="flex-1" />
        <Button type="submit" disabled={busy || !postcode.trim()}>
          Save
        </Button>
      </form>
      <div className="flex flex-wrap gap-4">
        <Button type="button" variant="secondary" onClick={useMine} disabled={busy}>
          Use my location
        </Button>
        {place && (
          <Button type="button" variant="quiet" onClick={() => void send('DELETE')} disabled={busy}>
            Clear location
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-[13px] text-muted">Only the postcode’s first half and a location rounded to about 1 km are kept.</p>
    </div>
  );
}
