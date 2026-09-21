import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { SESSION_COOKIE_NAME } from '@/lib/server/session';

const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

interface LoginResponseData {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = LoginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: parseResult.error.errors[0]?.message || 'Invalid input',
          errors: parseResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;

    // Call Google Apps Script backend
    const result = await callAppsScript<LoginResponseData>('auth.login', { email, password });

    if (!result.success || !result.data?.token) {
      const isBackendError = result.errors?.some(
        (e) => e.code?.startsWith('APPS_SCRIPT_') || e.code === 'BACKEND_CONNECTION_ERROR'
      );
      const isLocked = result.message?.toLowerCase().includes('locked');
      const status = isBackendError ? 502 : isLocked ? 429 : 401;

      return NextResponse.json(
        {
          success: false,
          data: null,
          message: result.message || 'Login failed. Please verify your credentials.',
          errors: result.errors,
        },
        { status }
      );
    }

    // Set httpOnly secure cookie with the opaque token
    const response = NextResponse.json({
      success: true,
      data: { user: result.data.user },
      message: 'Login successful',
    });

    response.cookies.set(SESSION_COOKIE_NAME, result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred during login';
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: msg,
        errors: [{ message: msg }],
      },
      { status: 500 }
    );
  }
}
