import { safeRedirect } from './paths';

/** Post-login destination: `next` or `redirectTo`, always run through safeRedirect. */
export function callbackDestination(params: URLSearchParams): string {
  return safeRedirect(params.get('next') ?? params.get('redirectTo'));
}

/** Where to send the user when the auth callback can't create a session. */
export function callbackFailureRedirect(params: URLSearchParams): string {
  return params.get('next') === '/reset-password' ? '/login?error=reset' : '/login?error=callback';
}
