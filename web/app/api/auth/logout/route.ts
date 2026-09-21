import { NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken, SESSION_COOKIE_NAME } from '@/lib/server/session';

export async function POST() {
  const token = getSessionToken();

  if (token) {
    try {
      // Invalidate session on Google Apps Script backend
      await callAppsScript('auth.logout', {}, token);
    } catch (e) {
      // Continue clearing cookie even if backend fails
    }
  }

  const response = NextResponse.json({
    success: true,
    data: null,
    message: 'Logged out successfully',
  });

  // Clear session cookie
  response.cookies.delete(SESSION_COOKIE_NAME);

  return response;
}
