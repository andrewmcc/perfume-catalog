import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { LocationForm } from '@/components/settings/location-form';
import { WeatherAttribution } from '@/components/today/attribution';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Settings' };

async function Location() {
  await connection();
  const supabase = await createServerClient();
  const { data } = await supabase.from('collection_settings').select('place, lat').maybeSingle();
  return <LocationForm place={data?.lat != null ? (data.place === 'Your location' ? 'your location' : (data.place ?? 'your location')) : null} />;
}

export default function Page() {
  return (
    <>
      <h1 className="font-display text-2xl italic">Settings</h1>
      <section aria-labelledby="location-h" className="label-card mt-5 p-4">
        <h2 id="location-h" className="mb-3 font-display text-lg italic">
          Location
        </h2>
        <Suspense fallback={<div className="h-40" />}>
          <Location />
        </Suspense>
      </section>
      <section className="label-card mt-4 p-4">
        <h2 className="font-display text-lg italic">Units</h2>
        <p className="mt-1 text-[15px] text-ink">Sizes are in ml.</p>
      </section>
      <form action="/auth/signout" method="post" className="mt-8">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
      <WeatherAttribution />
    </>
  );
}
