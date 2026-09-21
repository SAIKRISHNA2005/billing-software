import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

interface RouteContext {
  params: {
    entity: string;
    id: string;
  };
}

const VALID_ENTITIES = ['companies', 'clients', 'vendors', 'vehicles', 'drivers'];

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const { entity, id } = params;
    if (!VALID_ENTITIES.includes(entity)) {
      return NextResponse.json(
        { success: false, data: null, message: `Invalid master data entity: ${entity}` },
        { status: 400 }
      );
    }

    const action = `${entity}.get`;
    const result = await callAppsScript(action, { id }, sessionToken);

    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve master record';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const { entity, id } = params;
    if (!VALID_ENTITIES.includes(entity)) {
      return NextResponse.json(
        { success: false, data: null, message: `Invalid master data entity: ${entity}` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const action = `${entity}.update`;
    const result = await callAppsScript(action, { id, patch: body }, sessionToken);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update master record';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const { entity, id } = params;
    if (!VALID_ENTITIES.includes(entity)) {
      return NextResponse.json(
        { success: false, data: null, message: `Invalid master data entity: ${entity}` },
        { status: 400 }
      );
    }

    const action = `${entity}.deactivate`;
    const result = await callAppsScript(action, { id }, sessionToken);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate master record';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
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

    const { entity, id } = params;
    if (!VALID_ENTITIES.includes(entity)) {
      return NextResponse.json(
        { success: false, data: null, message: `Invalid master data entity: ${entity}` },
        { status: 400 }
      );
    }

    const body = await req.json();
    const action = body.action === 'reactivate' ? `${entity}.reactivate` : `${entity}.deactivate`;
    const result = await callAppsScript(action, { id }, sessionToken);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update status of master record';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
