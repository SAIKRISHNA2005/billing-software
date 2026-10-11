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

    const result = (await callAppsScript('bill.pending', params, sessionToken)) as any;

    if (result && result.success && result.data && Array.isArray(result.data.items) && result.data.items.length > 0) {
      try {
        const enqListRes = (await callAppsScript('enquiry.list', { limit: 100 }, sessionToken)) as any;
        const enqMap = new Map<string, any>();
        if (enqListRes && enqListRes.success && Array.isArray(enqListRes.data?.items)) {
          enqListRes.data.items.forEach((e: any) => {
            if (e.id) enqMap.set(e.id, e);
            if (e.enquiryNumber) enqMap.set(String(e.enquiryNumber), e);
          });
        }

        for (const item of result.data.items) {
          let e = enqMap.get(item.enquiryId) || enqMap.get(String(item.enquiryNumber));
          if (!e && item.enquiryId) {
            try {
              const singleRes = (await callAppsScript('enquiry.get', { id: item.enquiryId }, sessionToken)) as any;
              if (singleRes && singleRes.success && singleRes.data) {
                e = singleRes.data.enquiry || singleRes.data;
              }
            } catch {}
          }

          if (e) {
            item.advanceAmount = Number(e.advanceAmount) || 0;
            item.extraAdvance = Number(e.extraAdvance) || 0;
            item.totalAdvance = item.advanceAmount + item.extraAdvance;
            item.otherCharges = Number(e.otherCharges) || 0;
            item.dieselAmount = Number(e.dieselAmount) || 0;
            item.bonus = Number(e.bonus) || 0;
            if (e.customCharges) item.customCharges = e.customCharges;
            if (!item.vehicleNo && (e.vehicleNumber || e.vehicleNo)) item.vehicleNo = e.vehicleNumber || e.vehicleNo;
            if (!item.containerNo && (e.containerNumber || e.containerNo)) item.containerNo = e.containerNumber || e.containerNo;

            // Recalculate suggestedAmount to accurately deduct advance
            const freight = Number(item.freightAmount) || 0;
            const halting = Number(item.haltingAmount) || 0;
            const other = Number(item.otherCharges) || 0;
            let customSum = 0;
            if (Array.isArray(item.customCharges)) {
              customSum = item.customCharges.reduce((s: number, c: any) => s + (Number(c.amount || c.chargeAmount) || 0), 0);
            }
            const gross = freight + halting + other + customSum;
            item.suggestedAmount = Math.max(0, gross - item.totalAdvance);
          }
        }
      } catch (enrichErr) {
        console.warn('[BillingPending] Error enriching pending items with enquiry details:', enrichErr);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch pending bills' },
      { status: 500 }
    );
  }
}
