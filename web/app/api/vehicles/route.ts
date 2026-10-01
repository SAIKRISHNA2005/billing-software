import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized session' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const params = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '50',
      search: searchParams.get('search') || '',
      active: searchParams.get('active') ?? undefined,
    };

    const result = await callAppsScript('vehicles.list', params, sessionToken);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, data: null, message: error.message || 'Failed to fetch vehicles' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized session' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = await callAppsScript('vehicles.create', body, sessionToken);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, data: null, message: error.message || 'Failed to create vehicle' },
      { status: 500 }
    );
  }
}
