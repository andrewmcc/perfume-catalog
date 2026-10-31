import { describe, expect, it } from 'vitest';
import { callbackDestination, callbackFailureRedirect } from '../callback';

describe('callbackFailureRedirect', () => {
  it('distinguishes reset from generic failures', () => {
    expect(callbackFailureRedirect(new URLSearchParams('next=/reset-password&code=x'))).toBe('/login?error=reset');
    expect(callbackFailureRedirect(new URLSearchParams('code=x'))).toBe('/login?error=callback');
  });
});

describe('callbackDestination', () => {
  it('prefers next, then redirectTo, then /today', () => {
    expect(callbackDestination(new URLSearchParams('next=/reset-password'))).toBe('/reset-password');
    expect(callbackDestination(new URLSearchParams('redirectTo=/review'))).toBe('/review');
    expect(callbackDestination(new URLSearchParams(''))).toBe('/today');
  });
  it('rejects open redirects', () => {
    expect(callbackDestination(new URLSearchParams('next=//evil.com'))).toBe('/today');
    expect(callbackDestination(new URLSearchParams('redirectTo=/\\evil.com'))).toBe('/today');
  });
});
