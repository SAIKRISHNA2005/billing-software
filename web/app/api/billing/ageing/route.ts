import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/server/session';
import { callAppsScript } from '@/lib/server/appsScriptClient';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const response = await callAppsScript('billPayment.ageing', {}, sessionToken);

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
