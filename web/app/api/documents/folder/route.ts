import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

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
    const vehicleId = searchParams.get('vehicleId') || searchParams.get('id');

    if (!vehicleId) {
      return NextResponse.json(
        { success: false, data: null, message: 'vehicleId is required' },
        { status: 400 }
      );
    }

    const result = await callAppsScript('documents.folder', { vehicleId }, sessionToken);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, data: null, message: error.message || 'Failed to get vehicle Drive folder' },
      { status: 500 }
    );
  }
}
