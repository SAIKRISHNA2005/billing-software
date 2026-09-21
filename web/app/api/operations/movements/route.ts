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
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '30',
      search: searchParams.get('search') || '',
      companyId: searchParams.get('companyId') || undefined,
      clientId: searchParams.get('clientId') || undefined,
      vendorId: searchParams.get('vendorId') || undefined,
      loadingType: searchParams.get('loadingType') || undefined,
      movementStatus: searchParams.get('movementStatus') || undefined,
      shippingStatus: searchParams.get('shippingStatus') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      sortField: searchParams.get('sortField') || 'enquiryNumber',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    const result = await callAppsScript('operations.movements', params, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve active vehicle movements';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
