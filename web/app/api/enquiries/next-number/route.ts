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

    const currentYear = new Date().getFullYear();
    const prefix = `INV-${currentYear}-`;

    // Fetch existing enquiries to find the latest invoiceNumber
    const result = await callAppsScript<any>('enquiry.list', { limit: 100 }, sessionToken);
    let maxNumber = 0;

    if (result.success && result.data?.items && Array.isArray(result.data.items)) {
      result.data.items.forEach((item: any) => {
        if (item.invoiceNumber && String(item.invoiceNumber).startsWith(prefix)) {
          const numPart = parseInt(String(item.invoiceNumber).replace(prefix, ''), 10);
          if (!isNaN(numPart) && numPart > maxNumber) {
            maxNumber = numPart;
          }
        }
      });
    }

    const nextSeq = maxNumber + 1;
    const nextInvoiceNumber = `${prefix}${String(nextSeq).padStart(3, '0')}`;

    return NextResponse.json({
      success: true,
      data: {
        nextInvoiceNumber,
        year: currentYear,
        sequence: nextSeq,
      },
      message: 'Next invoice number generated',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve next numbers';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
