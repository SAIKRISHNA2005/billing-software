import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';
import { computeVehicleAlerts } from '@/lib/server/vehicleAlertsHelper';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized session' }, { status: 401 });
    }

    const result = await callAppsScript<any>('dashboard.summary', {}, sessionToken);

    if (result.success && result.data) {
      // 1. Fallback for recentEnquiries if omitted by Apps Script
      if (!result.data.recentEnquiries || result.data.recentEnquiries.length === 0) {
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
        } catch {
          // non-blocking
        }
      }

      // 2. Fallback for vehicleAlerts: ensure compliance renewal alerts are ALWAYS populated
      if (!result.data.vehicleAlerts || !Array.isArray(result.data.vehicleAlerts)) {
        try {
          const vehiclesRes = await callAppsScript<{ items: any[] }>('vehicles.list', { limit: 500 }, sessionToken);
          const vehicleList = vehiclesRes.success && Array.isArray(vehiclesRes.data?.items) ? vehiclesRes.data.items : [];
          result.data.vehicleAlerts = computeVehicleAlerts(vehicleList, 30);
        } catch (vehErr) {
          console.warn('[DashboardSummaryRoute] Failed to fetch vehicles for alerts:', vehErr);
          result.data.vehicleAlerts = [];
        }
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch dashboard summary' },
      { status: 500 }
    );
  }
}
