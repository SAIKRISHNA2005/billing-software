import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

export async function POST(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized session' }, { status: 401 });
    }

    const body = await req.json();
    const { category, id } = body;

    if (!id || !category) {
      return NextResponse.json(
        { success: false, message: 'Both category and id are required to restore a record' },
        { status: 400 }
      );
    }

    const result = await callAppsScript('trashbin.restore', { category, id }, sessionToken);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to restore record' },
      { status: 500 }
    );
  }
}
