import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/server/session';
import { callAppsScript } from '@/lib/server/appsScriptClient';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const billId = params.id;
    const response = await callAppsScript('bill.generatePdf', { billId }, sessionToken);

    if (!response.success || !response.data) {
      return NextResponse.json(
        { success: false, message: response.message || 'Failed to generate PDF' },
        { status: 400 }
      );
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
