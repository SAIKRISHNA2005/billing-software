import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const { id } = params;
    const result = (await callAppsScript('enquiry.get', { id }, sessionToken)) as any;
    if (result.success && result.data) {
      const { extractContainersFromEnquiry, cleanEnquiryComments } = await import('@/lib/utils/enquiryContainers');
      const enquiry = result.data.enquiry || result.data;
      enquiry.containers = extractContainersFromEnquiry(enquiry);
      enquiry.comments = cleanEnquiryComments(enquiry.comments);
    }
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve enquiry';
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

    const { id } = params;
    const body = await req.json();
    const patch = body.patch || body;

    if (patch.containers && Array.isArray(patch.containers)) {
      const { embedContainersInComments } = await import('@/lib/utils/enquiryContainers');
      patch.comments = embedContainersInComments(patch.comments, patch.containers);
    }

    const result = (await callAppsScript('enquiry.update', { id, patch }, sessionToken)) as any;
    if (result.success && result.data) {
      const { extractContainersFromEnquiry, cleanEnquiryComments } = await import('@/lib/utils/enquiryContainers');
      const enquiryData = result.data.enquiry || result.data;
      enquiryData.containers = extractContainersFromEnquiry(enquiryData);
      enquiryData.comments = cleanEnquiryComments(enquiryData.comments);
      const { syncEnquiryToReports } = await import('@/lib/server/reportSyncService');
      syncEnquiryToReports(enquiryData, body.oldCompanyName, sessionToken).catch((err) =>
        console.error('[LiveSync] Enquiry update sync failed:', err)
      );
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update enquiry';
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

    const { id } = params;
    const result = await callAppsScript('enquiry.delete', { id }, sessionToken);
    if (result.success) {
      const { deleteEnquiryFromReports } = await import('@/lib/server/reportSyncService');
      deleteEnquiryFromReports(id, undefined, sessionToken).catch((err) =>
        console.error('[LiveSync] Enquiry delete sync failed:', err)
      );
    }
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete enquiry';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}

