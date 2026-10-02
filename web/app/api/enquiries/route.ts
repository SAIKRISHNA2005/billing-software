import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';
import { serverCache } from '@/lib/server/cache';

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
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || '',
      companyId: searchParams.get('companyId') || undefined,
      clientId: searchParams.get('clientId') || undefined,
      stage: searchParams.get('stage') || undefined,
      vendorId: searchParams.get('vendorId') || undefined,
      loadingType: searchParams.get('loadingType') || undefined,
      movementStatus: searchParams.get('movementStatus') || undefined,
      shippingStatus: searchParams.get('shippingStatus') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      sortField: searchParams.get('sortField') || 'enquiryNumber',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    const cacheKey = `enquiry:list:${JSON.stringify(params)}`;
    const cached = serverCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }

    const result = await callAppsScript('enquiry.list', params, sessionToken);
    if (result.success && result.data) {
      serverCache.set(cacheKey, result, 15); // 15s TTL
    }
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve enquiries';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = (await callAppsScript('enquiry.create', body, sessionToken)) as any;
    if (result.success) {
      serverCache.invalidatePattern('enquiry');
      serverCache.invalidatePattern('dashboard');
      if (result.data) {
        const enquiryData = result.data.enquiry || result.data;
        const movementData = result.data.movement || {};
        const mergedEnquiry = {
          ...body,
          ...enquiryData,
          id: enquiryData.id || result.data.id,
          enquiryNumber: enquiryData.enquiryNumber || result.data.enquiryNumber,
          transactionNumber: enquiryData.transactionNumber || result.data.transactionNumber,
          movement: { ...(body.movement || {}), ...movementData },
        };
        const { syncEnquiryToReports } = await import('@/lib/server/reportSyncService');
        syncEnquiryToReports(mergedEnquiry, undefined, sessionToken).catch((err) =>
          console.error('[LiveSync] Enquiry create sync failed:', err)
        );
      }
    }

    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create enquiry';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}

