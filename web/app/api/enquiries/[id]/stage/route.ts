import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json();

    const payload = {
      id,
      toStage: body.toStage,
      remarks: body.remarks || '',
    };

    const result = await callAppsScript('enquiry.moveStage', payload, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to transition enquiry stage';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
