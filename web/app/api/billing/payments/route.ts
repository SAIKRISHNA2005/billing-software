import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/server/session';
import { callAppsScript } from '@/lib/server/appsScriptClient';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const billId = searchParams.get('billId') || undefined;
    const clientId = searchParams.get('clientId') || undefined;
    const paymentMode = searchParams.get('paymentMode') || undefined;

    const response = await callAppsScript('billPayment.list', { billId, clientId, paymentMode }, sessionToken);

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const response = await callAppsScript('billPayment.create', body, sessionToken);

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
