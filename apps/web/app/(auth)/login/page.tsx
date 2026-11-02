'use client';

import { createBrowserClient } from '@perfume/supabase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { safeRedirect } from '@/lib/auth/paths';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AuthShell, FormError, linkClass } from '../shell';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safeRedirect(params.get('redirectTo'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('error') === 'reset'
      ? 'That link has expired or was opened in a different browser. Request a new one.'
      : params.get('error')
        ? 'Sign-in link failed. Please try again.'
        : null,
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } = await createBrowserClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    // Never echo what was typed: a password pasted into the email field would leak.
    if (authError) return setError('Email or password is incorrect.');
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl italic">Sign in</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Link href="/forgot-password" className={`${linkClass} self-start`}>
          Forgot password?
        </Link>
        {error && <FormError>{error}</FormError>}
        <Button type="submit" disabled={busy}>
          {busy ? 'One moment…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">Access is by invitation only.</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
