import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'tms_session';

/**
 * Gets the current session token from httpOnly cookie.
 */
export function getSessionToken(): string | null {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  return sessionCookie?.value || null;
}
