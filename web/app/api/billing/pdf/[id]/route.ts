import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/server/session';
import { mapBillData } from '@/lib/server/pdf/billDataMapper';
import { generateBillHtml } from '@/lib/server/pdf/billTemplate';
import { generateBillPdfBuffer, generateBillPdfBase64 } from '@/lib/server/pdf/billPdfGenerator';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized session' }, { status: 401 });
    }

    const billId = params.id;
    if (!billId || !billId.trim()) {
      return NextResponse.json({ success: false, message: 'Bill ID is required' }, { status: 400 });
    }

    // 1. Fetch & map bill data from Excel / Production sources
    const billData = await mapBillData(billId, sessionToken);

    // 2. Render structured HTML using the Sri Ponniamman Trans A4 bill template
    const html = generateBillHtml(billData);

    const safeNumber = (billData.billNumber || billData.id).replace(/[\/\\]/g, '-');
    const filename = `Invoice_${safeNumber}.pdf`;

    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get('format');

    // If direct PDF streaming is requested
    if (format === 'pdf' || format === 'binary') {
      const pdfBuffer = await generateBillPdfBuffer(html);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Default: Return JSON with Base64 for the Processed Bills UI instant download
    const pdfBase64 = await generateBillPdfBase64(html);

    return NextResponse.json({
      success: true,
      data: {
        billId: billData.id,
        billNumber: billData.billNumber,
        pdfBase64,
        html,
        amountInWords: billData.totalInWords,
        clientName: billData.client.name,
        totalAmount: billData.totals.grandTotal,
      },
      message: 'Bill PDF generated successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An error occurred while generating the bill PDF';
    console.error('[BillPDFRoute] Error:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        message,
      },
      { status: 404 }
    );
  }
}
