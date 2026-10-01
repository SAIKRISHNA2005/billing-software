import { NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken, SESSION_COOKIE_NAME } from '@/lib/server/session';

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

  return NextResponse.json({
    success: true,
    data: result.data,
    message: 'User authenticated',
  });
}
