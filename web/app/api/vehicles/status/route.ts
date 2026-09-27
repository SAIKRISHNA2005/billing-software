import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

export async function POST(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { vehicleNumber, sentForWork, enquiryId, vehicleId } = body;

    if (!vehicleNumber && !vehicleId && !enquiryId) {
      return NextResponse.json(
        { success: false, data: null, message: 'Missing vehicle identifier or enquiry ID' },
        { status: 400 }
      );
    }

    // Call Google Apps Script backend to persist the operational status
    // 1. If enquiryId is present, update the enquiry movement status
    if (enquiryId) {
      await callAppsScript(
        'enquiries.updateMovement',
        {
          id: enquiryId,
          movementStatus: sentForWork ? 'IN_TRANSIT' : 'NOT_MOVED',
          vehicleStatus: sentForWork ? 'SENT_FOR_WORK' : 'IN_YARD',
        },
        sessionToken
      );
    }

    // 2. If vehicleId or vehicleNumber is present, update vehicles master
    if (vehicleId) {
      await callAppsScript(
        'vehicles.update',
        {
          id: vehicleId,
          sentForWork: Boolean(sentForWork),
          status: sentForWork ? 'SENT_FOR_WORK' : 'AVAILABLE',
        },
        sessionToken
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        vehicleNumber,
        sentForWork: Boolean(sentForWork),
        enquiryId,
        vehicleId,
        updatedAt: new Date().toISOString(),
      },
      message: `Vehicle ${vehicleNumber || 'status'} updated to ${sentForWork ? 'SENT FOR WORK' : 'NOT SENT FOR WORK'}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update vehicle status';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
