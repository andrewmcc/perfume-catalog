export type ResetError = { message: string; expired?: boolean };

/** Friendly copy for Supabase's raw updateUser errors on the reset form. */
export function friendlyResetError(raw: string | null | undefined): ResetError {
  const e = (raw ?? '').toLowerCase();
  if (/session.*missing|expired|invalid.*(token|jwt)|not authenticated|jwt/.test(e)) {
    return { message: 'This reset link has expired. Request a new one.', expired: true };
  }
  if (/different from the old|same.*password/.test(e)) return { message: 'Choose a password you haven\'t used before.' };
  if (/at least|too short|weak|password should/.test(e)) return { message: 'Use at least 8 characters.' };
  if (/rate|too many|seconds/.test(e)) return { message: 'Too many tries. Wait a minute and try again.' };
  return { message: "Couldn't save the new password. Try again." };
}
