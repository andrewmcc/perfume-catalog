'use client';

import { createBrowserClient } from '@perfume/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { friendlyResetError, type ResetError } from '@/lib/auth/reset-error';
import { AuthShell, buttonClass, inputClass } from '../shell';

/** Sets the password for the session /auth/confirm just created (invite or recovery). */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ResetError | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: authError } = await createBrowserClient().auth.updateUser({ password });
    setBusy(false);
    if (authError) return setError(friendlyResetError(authError.message));
    router.replace('/today');
    router.refresh();
  }

  return (
    <AuthShell>
      <div>
        <h1 className="mb-2 text-2xl font-semibold">Set your password</h1>
        <p className="mb-6 text-sm opacity-70">Choose the password you will use to sign in.</p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            Password
            <input className={inputClass} type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="opacity-70">At least 8 characters</span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error.message}
              {error.expired && (
                <>
                  {' '}
                  <Link href="/forgot-password" className="underline underline-offset-4">
                    Request a new link
                  </Link>
                </>
              )}
            </p>
          )}
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? 'One moment…' : 'Save password'}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
