import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const params = {
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      vendorId: searchParams.get('vendorId') || undefined,
      companyId: searchParams.get('companyId') || undefined,
      clientId: searchParams.get('clientId') || undefined,
      loadingType: searchParams.get('loadingType') || undefined,
    };

    const result = await callAppsScript('vendor.report', params, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve vendor report';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
