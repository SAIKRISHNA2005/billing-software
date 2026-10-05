import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

export async function GET(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json({ success: false, message: 'Unauthorized session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all';
    const search = searchParams.get('search') || '';

    const result: any = await callAppsScript('trashbin.list', { category, search }, sessionToken);
    const inner = result?.data?.data || result?.data || result;
    return NextResponse.json({
      success: true,
      data: {
        items: inner?.items || [],
        counts: inner?.counts || {
          total: 0,
          vehicle: 0,
          generalExpense: 0,
          loadingExpense: 0,
          dailyReport: 0,
          billing: 0,
          vendor: 0,
          driver: 0,
          container: 0,
        },
        total: inner?.total !== undefined ? inner.total : (inner?.items?.length || 0),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to list trashbin records' },
      { status: 500 }
    );
  }
}
