'use client';

import { createBrowserClient } from '@perfume/supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { friendlyResetError, type ResetError } from '@/lib/auth/reset-error';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AuthShell, FormError, linkClass } from '../shell';

/** Sets the password for the session /auth/confirm just created (invite or recovery). */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ResetError | null>(null);
  const [busy, setBusy] = useState(false);
  // undefined while checking; null means no session (the link was never confirmed or has expired).
  const [account, setAccount] = useState<string | null | undefined>(undefined);

  // Show whose password this sets, so a link that signed in the wrong account is obvious.
  useEffect(() => {
    createBrowserClient()
      .auth.getUser()
      .then(({ data }) => setAccount(data.user?.email ?? null));
  }, []);

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

  if (account === undefined) return <AuthShell>{null}</AuthShell>;
  if (account === null) {
    return (
      <AuthShell>
        <div>
          <h1 className="mb-2 font-display text-2xl italic">Link expired</h1>
          <p role="alert" className="mb-4 text-sm">
            This link has expired or was already used.
          </p>
          <Link href="/forgot-password" className={linkClass}>
            Request a new link
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div>
        <h1 className="mb-2 font-display text-2xl italic">Set your password</h1>
        <p className="mb-6 text-sm text-muted">
          Setting the password for <strong className="font-semibold text-ink [overflow-wrap:anywhere]">{account}</strong>
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            label="Password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            help="At least 8 characters"
          />
          {error && (
            <FormError>
              {error.message}
              {error.expired && (
                <>
                  {' '}
                  <Link href="/forgot-password" className="underline underline-offset-4">
                    Request a new link
                  </Link>
                </>
              )}
            </FormError>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'One moment…' : 'Save password'}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
