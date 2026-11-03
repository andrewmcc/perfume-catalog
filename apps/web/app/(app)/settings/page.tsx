import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { DeleteAccount } from '@/components/settings/delete-account';
import { LocationForm } from '@/components/settings/location-form';
import { WeatherAttribution } from '@/components/today/attribution';
import { Button } from '@/components/ui/button';
import { createServerClient } from '@/lib/supabase/server';
import { LoadingFlacon } from '@/components/ui/loading-flacon';

export const metadata: Metadata = { title: 'Settings' };

async function Location() {
  await connection();
  const supabase = await createServerClient();
  const { data } = await supabase.from('collection_settings').select('place, lat').maybeSingle();
  return <LocationForm place={data?.lat != null ? (data.place === 'Your location' ? 'your location' : (data.place ?? 'your location')) : null} />;
}

async function AccountEmail() {
  await connection();
  const { data } = await (await createServerClient()).auth.getClaims();
  const email = data?.claims?.email;
  return email ? <p className="mt-1 text-[15px] text-ink">Signed in as {email}</p> : null;
}

export default function Page() {
  return (
    <>
      <h1 className="font-display text-2xl italic">Settings</h1>
      <section aria-labelledby="location-h" className="label-card mt-5 p-4">
        <h2 id="location-h" className="mb-3 font-display text-lg italic">
          Location
        </h2>
        <Suspense fallback={<LoadingFlacon size="sm" label="Finding your weather…" />}>
          <Location />
        </Suspense>
      </section>
      <section className="label-card mt-4 p-4">
        <h2 className="font-display text-lg italic">Units</h2>
        <p className="mt-1 text-[15px] text-ink">Sizes are in ml.</p>
      </section>
      <section aria-labelledby="account-h" className="label-card mt-4 p-4">
        <h2 id="account-h" className="font-display text-lg italic">
          Account
        </h2>
        <Suspense fallback={<p className="mt-1 h-6" />}>
          <AccountEmail />
        </Suspense>
        <form action="/auth/signout" method="post" className="mt-3">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
        <div className="mt-3">
          <DeleteAccount />
        </div>
      </section>
      <WeatherAttribution />
    </>
  );
}
