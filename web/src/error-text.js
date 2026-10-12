// Error texts that more than one place shows (audit C5). Sign-in texts are
// generic: never more than "wrong password" or "wait".

/** A request that got no reply (status 0). */
export const CANNOT_CONNECT = 'Cannot connect to the server. Try again.';

/**
 * @param {number} status HTTP status, or 0 for a network failure.
 * @param {{ retryAfterSeconds?: number } | null} data
 */
export function loginErrorText(status, data) {
  if (status === 401) return 'Wrong password.';
  if (status === 429) {
    const minutes = Math.max(1, Math.ceil((data?.retryAfterSeconds ?? 900) / 60));
    return `Too many failed attempts. Wait ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, then try again.`;
  }
  if (status === 0) return CANNOT_CONNECT;
  return 'Could not sign in. Try again.';
}
