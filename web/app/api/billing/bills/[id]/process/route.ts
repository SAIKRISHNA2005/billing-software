import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized session' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const payload = { ...body, id: params.id };

    const result = await callAppsScript('bill.process', payload, sessionToken);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to process bill' },
      { status: 500 }
    );
  }
}
