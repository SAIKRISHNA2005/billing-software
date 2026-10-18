import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';
import { computeVehicleAlerts } from '@/lib/server/vehicleAlertsHelper';

export interface VehicleAlert {
  vehicleId: string;
  vehicleNumber: string;
  ownerName?: string;
  documentKey: string;
  documentLabel: string;
  expiryDate: string;
  daysRemaining: number;
  isExpired: boolean;
  vehicle?: any;
}

export async function GET(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    // First try backend action
    const backendResult = await callAppsScript<VehicleAlert[]>('vehicles.alerts', {}, sessionToken);
    if (backendResult.success && Array.isArray(backendResult.data)) {
      return NextResponse.json(backendResult);
    }

    // Fallback calculation directly in Next.js from vehicle list if backend action is warming up
    const vehiclesRes = await callAppsScript<{ items: any[] }>('vehicles.list', { limit: 500 }, sessionToken);
    const vehicles = vehiclesRes.data?.items || [];
    const alerts = computeVehicleAlerts(vehicles, 30);

    return NextResponse.json({
      success: true,
      data: alerts,
      message: 'Vehicle alerts fetched successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, data: [], message: error.message || 'Error fetching vehicle alerts' },
      { status: 500 }
    );
  }
}
