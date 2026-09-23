import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from '@/lib/server/session';
import { callAppsScript } from '@/lib/server/appsScriptClient';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const response = await callAppsScript(
      'billPayment.update',
      { id: params.id, patch: body },
      sessionToken
    );

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionToken = await getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const response = await callAppsScript('billPayment.delete', { id: params.id }, sessionToken);

    return NextResponse.json(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
