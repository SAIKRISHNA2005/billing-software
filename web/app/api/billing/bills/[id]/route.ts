import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized session' }, { status: 401 });
    }

    const result = await callAppsScript('bill.get', { id: params.id }, sessionToken);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch bill' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized session' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.status === 'PROCESSED' || body.isProcessed ? 'bill.updateProcessed' : 'bill.create';
    const payload = { ...body, id: params.id };

    const result = (await callAppsScript(action, payload, sessionToken)) as any;
    if (result.success && result.data && (result.data.status === 'PROCESSED' || body.status === 'PROCESSED')) {
      const { syncProcessedBillToReports } = await import('@/lib/server/reportSyncService');
      syncProcessedBillToReports(result.data, sessionToken).catch((err) =>
        console.error('[LiveSync] Bill update sync failed:', err)
      );
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update bill' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized session' }, { status: 401 });
    }

    const result = await callAppsScript('bill.deleteDraft', { id: params.id }, sessionToken);
    if (result.success) {
      const { deleteProcessedBillFromReports } = await import('@/lib/server/reportSyncService');
      deleteProcessedBillFromReports(params.id, undefined, sessionToken).catch((err) =>
        console.error('[LiveSync] Bill delete sync failed:', err)
      );
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete draft bill' },
      { status: 500 }
    );
  }
}

