import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

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
    const alerts: VehicleAlert[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const validityFields = [
      { key: 'fitnessValidUpTo', label: 'Fitness Valid UpTo' },
      { key: 'taxValidUpTo', label: 'Tax Valid UpTo' },
      { key: 'insuranceValidUpTo', label: 'Insurance Valid UpTo' },
      { key: 'puccValidUpTo', label: 'PUCC Valid UpTo' },
      { key: 'permitValidUpTo', label: 'Permit Valid UpTo' },
      { key: 'nationalPermitValidUpTo', label: 'National Permit Valid UpTo' },
    ];

    vehicles.forEach((v: any) => {
      validityFields.forEach((f) => {
        const val = v[f.key];
        if (val) {
          const dateObj = new Date(val);
          if (!isNaN(dateObj.getTime())) {
            const expDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // Alert if expiring in <= 3 days or already expired
            if (diffDays <= 3) {
              alerts.push({
                vehicleId: v.id,
                vehicleNumber: v.vehicleNumber,
                ownerName: v.ownerName || '',
                documentKey: f.key,
                documentLabel: f.label,
                expiryDate: val,
                daysRemaining: diffDays,
                isExpired: diffDays < 0,
                vehicle: v,
              });
            }
          }
        }
      });
    });

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
