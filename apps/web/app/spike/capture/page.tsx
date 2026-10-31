import { Suspense } from 'react';
import { connection } from 'next/server';
import CaptureClient from './capture-client';

// Server wrapper: the Supabase URL and anon key are read at request time and passed
// down as props, so no NEXT_PUBLIC_* vars are needed. The route is behind the
// spike passcode gate (proxy.ts).
async function Capture() {
  await connection();
  return (
    <CaptureClient supabaseUrl={process.env.SUPABASE_URL ?? ''} supabaseAnonKey={process.env.SUPABASE_ANON_KEY ?? ''} />
  );
}

export default function CapturePage() {
  return (
    <Suspense>
      <Capture />
    </Suspense>
  );
}
