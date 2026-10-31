'use client';

import { createBrowserClient } from '@perfume/supabase';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthShell, buttonClass, inputClass } from '../shell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const base = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const { error: authError } = await createBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${base}/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    if (authError) return setError("Couldn't send the email. Try again in a minute.");
    // Same message whether or not the address has an account.
    setNotice('If that address has an account, a reset link is on its way.');
  }

  return (
    <AuthShell>
      <div>
        <h1 className="mb-6 text-2xl font-semibold">Reset your password</h1>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            Email
            <input className={inputClass} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? 'One moment…' : 'Email me a reset link'}
          </button>
        </form>
        <Link href="/login" className="mt-4 inline-flex min-h-11 items-center text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
