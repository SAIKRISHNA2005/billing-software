import { NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken, SESSION_COOKIE_NAME } from '@/lib/server/session';
import { serverCache } from '@/lib/server/cache';

interface MeResponseData {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export async function GET() {
  const token = getSessionToken();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: 'Unauthorized: No active session',
        errors: [{ code: 'UNAUTHORIZED', message: 'No session token cookie found' }],
      },
      { status: 401 }
    );
  }

  // 1. Check server-side memory cache first (180s TTL)
  const cachedUser = serverCache.get<{ id: string; name: string; email: string }>('user_session_' + token);
  if (cachedUser) {
    return NextResponse.json({
      success: true,
      data: { user: cachedUser },
      message: 'Active session (cached)',
    });
  }

  const result = await callAppsScript<MeResponseData>('auth.me', {}, token);

  if (!result.success || !result.data?.user) {
    const isBackendError = result.errors?.some(
      (e) => e.code?.startsWith('APPS_SCRIPT_') || e.code === 'BACKEND_CONNECTION_ERROR'
    );

    if (isBackendError) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: 'Backend service momentarily unavailable',
          errors: result.errors,
        },
        { status: 502 }
      );
    }

    const response = NextResponse.json(
      {
        success: false,
        data: null,
        message: result.message || 'Session expired or invalid',
        errors: result.errors || [{ code: 'UNAUTHORIZED', message: 'Invalid session' }],
      },
      { status: 401 }
    );
    // Clear dead cookie only when definitively invalid/expired
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  // Cache authenticated user session for 3 minutes (180s)
  serverCache.set('user_session_' + token, result.data.user, 180);

  return NextResponse.json({
    success: true,
    data: result.data,
    message: 'User authenticated',
  });
}
