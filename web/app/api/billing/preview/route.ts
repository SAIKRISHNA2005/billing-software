import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/server/session';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { mapBillData } from '@/lib/server/pdf/billDataMapper';
import { generateBillHtml } from '@/lib/server/pdf/billTemplate';
import { generateBillPdfBuffer, generateBillPdfBase64 } from '@/lib/server/pdf/billPdfGenerator';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = await getSessionToken();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'html';
    let targetBillId = searchParams.get('id') || searchParams.get('billId');

    // If no specific bill requested, fetch the latest real bill from Google Sheets
    if (!targetBillId) {
      const listRes = await callAppsScript<{ items: Array<{ id: string }> }>('bill.list', { limit: 1 }, sessionToken);
      if (listRes.success && listRes.data?.items && listRes.data.items.length > 0) {
        targetBillId = listRes.data.items[0].id;
      }
    }

    if (!targetBillId) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: 'No processed bills found in Google Sheets. Please process an enquiry first to generate a bill.',
        },
        { status: 404 }
      );
    }

    // Map real bill data directly from Google Sheets
    const billData = await mapBillData(targetBillId, sessionToken);
    const html = generateBillHtml(billData);

    if (format === 'html') {
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    const safeNumber = (billData.billNumber || billData.id).replace(/[\/\\]/g, '-');

    if (format === 'pdf' || format === 'binary') {
      const pdfBuffer = await generateBillPdfBuffer(html);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Invoice_${safeNumber}.pdf"`,
        },
      });
    }

    const pdfBase64 = await generateBillPdfBase64(html);
    return NextResponse.json({
      success: true,
      data: {
        ...billData,
        pdfBase64,
        html,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error generating bill preview';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
