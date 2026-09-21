import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params = {
      companyId: searchParams.get('companyId') || '',
      clientId: searchParams.get('clientId') || '',
      search: searchParams.get('search') || ''
    };

    const result = await callAppsScript('bill.pending', params, sessionToken);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch pending bills' },
      { status: 500 }
    );
  }
}
