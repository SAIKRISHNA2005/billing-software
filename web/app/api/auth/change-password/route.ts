import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken, SESSION_COOKIE_NAME } from '@/lib/server/session';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});

export async function POST(req: NextRequest) {
  const token = getSessionToken();

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: 'Unauthorized: You must be logged in to change your password',
        errors: [{ code: 'UNAUTHORIZED', message: 'No session token' }],
      },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parseResult = ChangePasswordSchema.safeParse(body);

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

    const { currentPassword, newPassword } = parseResult.data;

    const result = await callAppsScript(
      'auth.changePassword',
      { currentPassword, newPassword },
      token
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: result.message || 'Failed to change password',
          errors: result.errors,
        },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      data: null,
      message: 'Password changed successfully. Please log in again with your new password.',
    });

    // Clear session cookie so user logs in with new password
    response.cookies.delete(SESSION_COOKIE_NAME);

    return response;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to change password';
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
