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

    // Resolve client IP and Geolocation
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfIp = req.headers.get('cf-connecting-ip');
    const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || cfIp || '127.0.0.1';

    const city = req.headers.get('x-vercel-ip-city') || req.headers.get('cf-ipcity');
    const region = req.headers.get('x-vercel-ip-country-region') || req.headers.get('cf-region');
    const country = req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry');

    let location = body.location || body.clientLocation;
    const lat = body.latitude !== undefined ? Number(body.latitude) : null;
    const lng = body.longitude !== undefined ? Number(body.longitude) : null;
    const acc = body.accuracy !== undefined ? Math.round(Number(body.accuracy)) : null;

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      const coordsStr = `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}${acc ? ` (±${acc}m)` : ''}`;
      if (location && typeof location === 'string') {
        if (!location.includes('GPS:')) {
          location = `${location} [${coordsStr}]`;
        }
      } else {
        location = `Exact Location [${coordsStr}]`;
      }
    } else if (!location) {
      if (city && country) {
        location = `${city}, ${region ? region + ', ' : ''}${country}`;
      } else {
        location = 'Chennai, Tamil Nadu, India';
      }
    }

    // Call Google Apps Script backend
    const result = await callAppsScript<LoginResponseData>('auth.login', {
      email,
      password,
      location,
      ipAddress: ip,
    });

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
