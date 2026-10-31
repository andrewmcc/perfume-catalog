import { describe, expect, it } from 'vitest';
import { friendlyResetError } from '../reset-error';

describe('friendlyResetError', () => {
  it('flags expired or missing sessions and offers a new link', () => {
    for (const raw of ['Auth session missing!', 'JWT expired', 'invalid JWT']) {
      expect(friendlyResetError(raw)).toEqual({ message: 'This reset link has expired. Request a new one.', expired: true });
    }
  });
  it('maps same-password, weak and unknown errors', () => {
    expect(friendlyResetError('New password should be different from the old password.').message).toMatch(/haven't used/);
    expect(friendlyResetError('Password should be at least 6 characters.').message).toBe('Use at least 8 characters.');
    expect(friendlyResetError('boom {"x":1}').message).toBe("Couldn't save the new password. Try again.");
    expect(friendlyResetError(null).expired).toBeUndefined();
  });
});
