'use client';

import { createBrowserClient } from '@perfume/supabase';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { safeRedirect } from '@/lib/auth/paths';
import { AuthShell, buttonClass, inputClass } from '../shell';

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
      <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Email
          <input className={inputClass} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Password
          <input className={inputClass} type="password" required minLength={8} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <Link href="/forgot-password" className="inline-flex min-h-11 items-center self-start text-sm underline underline-offset-4">
          Forgot password?
        </Link>
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'One moment…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-sm opacity-70">Access is by invitation only.</p>
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
