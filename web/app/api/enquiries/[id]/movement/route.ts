import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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
      enquiryId: id,
      movement: body.movement || body,
    };

    const result = await callAppsScript('enquiry.updateMovement', payload, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update movement times';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
