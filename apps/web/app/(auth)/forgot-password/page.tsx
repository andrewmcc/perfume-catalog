'use client';

import { createBrowserClient } from '@perfume/supabase';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { AuthShell, FormError, linkClass } from '../shell';

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
        <h1 className="mb-6 font-display text-2xl italic">Reset your password</h1>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {error && <FormError>{error}</FormError>}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? 'One moment…' : 'Email me a reset link'}
          </Button>
        </form>
        <Link href="/login" className={`${linkClass} mt-4`}>
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
