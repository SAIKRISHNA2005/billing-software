import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

interface RouteContext {
  params: {
    entity: string;
  };
}

const VALID_ENTITIES = ['companies', 'clients', 'vendors', 'vehicles', 'drivers', 'containers'];

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const { entity } = params;
    if (!VALID_ENTITIES.includes(entity)) {
      return NextResponse.json(
        { success: false, data: null, message: `Invalid master data entity: ${entity}` },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const isLookup = searchParams.get('lookup') === 'true';

    if (isLookup) {
      const action = `${entity}.lookup`;
      const query = {
        search: searchParams.get('search') || '',
        companyId: searchParams.get('companyId') || undefined,
        vendorId: searchParams.get('vendorId') || undefined,
        limit: searchParams.get('limit') || '20',
      };

      const result = await callAppsScript(action, query, sessionToken);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // Standard list query
    const action = `${entity}.list`;
    const listParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || '',
      active: searchParams.get('active') ?? undefined,
      sortField: searchParams.get('sortField') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    };

    const result = await callAppsScript(action, listParams, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve master data';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
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

    const { entity } = params;
    if (!VALID_ENTITIES.includes(entity)) {
      return NextResponse.json(
        { success: false, data: null, message: `Invalid master data entity: ${entity}` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const action = `${entity}.create`;

    const result = await callAppsScript(action, body, sessionToken);
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create master data record';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
