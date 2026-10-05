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

    const isBootstrap = searchParams.get('bootstrap') === 'true';
    const action = isBootstrap ? 'enquiries.bootstrap' : 'enquiry.list';

    let result = (await callAppsScript(action, params, sessionToken)) as any;
    if (isBootstrap && !result.success && typeof result.message === 'string' && result.message.includes('Action not supported')) {
      // Graceful fallback if Google Apps Script has not yet been redeployed with enquiries.bootstrap
      result = (await callAppsScript('enquiry.list', params, sessionToken)) as any;
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (isBootstrap && result.success && result.data?.enquiries) {
      return NextResponse.json({
        success: true,
        data: {
          items: result.data.enquiries.items || [],
          total: result.data.enquiries.total || 0,
          companies: result.data.companies || [],
          clients: result.data.clients || [],
          vendors: result.data.vendors || [],
        },
      });
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

