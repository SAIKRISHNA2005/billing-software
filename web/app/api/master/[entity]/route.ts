import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';
import { serverCache } from '@/lib/server/cache';

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
      const query = {
        search: searchParams.get('search') || '',
        companyId: searchParams.get('companyId') || undefined,
        vendorId: searchParams.get('vendorId') || undefined,
        limit: searchParams.get('limit') || '20',
      };

      const cacheKey = `master:lookup:${entity}:${JSON.stringify(query)}`;
      const cached = serverCache.get<any>(cacheKey);
      if (cached) {
        return NextResponse.json(cached, { status: 200 });
      }

      const action = `${entity}.lookup`;
      const result = await callAppsScript(action, query, sessionToken);
      if (result.success && result.data) {
        serverCache.set(cacheKey, result, 120); // 2 minutes TTL for lookups
      }
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // Standard list query
    const listParams = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || '',
      active: searchParams.get('active') ?? undefined,
      sortField: searchParams.get('sortField') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    };

    const cacheKey = `master:list:${entity}:${JSON.stringify(listParams)}`;
    const cached = serverCache.get<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }

    const action = `${entity}.list`;
    const result = await callAppsScript(action, listParams, sessionToken);
    if (result.success && result.data) {
      serverCache.set(cacheKey, result, 30); // 30 seconds TTL for list queries
    }
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

    const result = (await callAppsScript(action, body, sessionToken)) as any;
    if (result.success) {
      serverCache.invalidatePattern('master');
      if (entity === 'clients' && (body.name || result.data?.name)) {
        const clientName = body.name || result.data?.name;
        const { syncClientCreationToReports } = await import('@/lib/server/reportSyncService');
        syncClientCreationToReports(clientName, sessionToken).catch((err) =>
          console.error('[LiveSync] Client sheet auto-create sync failed:', err)
        );
      } else if (entity === 'companies' && (body.name || result.data?.name)) {
        const companyName = body.name || result.data?.name;
        const { syncCompanyCreationToReports } = await import('@/lib/server/reportSyncService');
        syncCompanyCreationToReports(companyName, sessionToken).catch((err) =>
          console.error('[LiveSync] Company sheet auto-create sync failed:', err)
        );
      }
    }
    return NextResponse.json(result, { status: result.success ? 201 : 400 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create master data record';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}

