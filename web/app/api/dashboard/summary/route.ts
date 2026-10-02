import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';
import { serverCache } from '@/lib/server/cache';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized session' }, { status: 401 });
    }

    const cacheKey = 'dashboard:summary';
    const cached = serverCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const result = await callAppsScript<any>('dashboard.summary', {}, sessionToken);

    if (result.success && result.data && (!result.data.recentEnquiries || result.data.recentEnquiries.length === 0)) {
      try {
        const enqRes = await callAppsScript<any>('enquiry.list', { limit: 20 }, sessionToken);
        if (enqRes.success && enqRes.data?.items) {
          result.data.recentEnquiries = enqRes.data.items.slice(0, 20).map((e: any) => ({
            id: e.id,
            enquiryNumber: e.enquiryNumber || e.id,
            transactionNumber: e.transactionNumber || e.transactionNo || '',
            companyName: e.companyName || '-',
            clientName: e.clientName || '-',
            date: e.date || e.createdAt,
            loadingType: e.loadingType || 'Import',
            vehicleNumber: e.vehicleNumber || e.vehicleNo || '-',
            stage: e.stage || 'BOOKED',
            freightAmount: Number(e.freightAmount) || 0,
          }));
        }
      } catch (e) {
        // non-blocking
      }
    }

    if (result.success && result.data) {
      serverCache.set(cacheKey, result, 20); // 20s TTL
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch dashboard summary' },
      { status: 500 }
    );
  }
}
