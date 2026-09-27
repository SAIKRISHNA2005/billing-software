import { NextRequest, NextResponse } from 'next/server';
import { runInitialFullSync } from '@/lib/server/reportSyncService';
import { getSessionToken } from '@/lib/server/session';

export async function POST(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized session' },
        { status: 401 }
      );
    }

    const result = await runInitialFullSync(sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        message: error.message || 'Failed to execute initial reporting sync',
      },
      { status: 500 }
    );
  }
}
