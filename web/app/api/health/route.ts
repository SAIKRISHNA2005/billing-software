import { NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';

interface HealthCheckData {
  ok: boolean;
  sheetConnected: boolean;
  spreadsheetName?: string;
  timestamp?: string;
}

/**
 * Health Check Route Handler
 * GET /api/health
 * Calls Google Apps Script 'health' action to test end-to-end connectivity.
 */
export async function GET() {
  const result = await callAppsScript<HealthCheckData>('health');

  if (!result.success) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result, { status: 200 });
}
