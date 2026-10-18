export interface VehicleAlert {
  vehicleId: string;
  vehicleNumber: string;
  ownerName?: string;
  documentKey: string;
  documentLabel: string;
  expiryDate: string;
  daysRemaining: number;
  isExpired: boolean;
  status: 'expired' | 'critical' | 'warning';
  vehicle?: any;
}

export const COMPLIANCE_VALIDITY_FIELDS = [
  { key: 'fitnessValidUpTo', label: 'Fitness Valid UpTo' },
  { key: 'taxValidUpTo', label: 'Tax Valid UpTo' },
  { key: 'insuranceValidUpTo', label: 'Insurance Valid UpTo' },
  { key: 'puccValidUpTo', label: 'PUCC Valid UpTo' },
  { key: 'permitValidUpTo', label: 'Permit Valid UpTo' },
  { key: 'nationalPermitValidUpTo', label: 'National Permit Valid UpTo' },
];

/**
 * Computes expired and expiring vehicle document compliance alerts
 * Alerts are triggered if expired (diffDays < 0), critical (<= 3 days), or warning (<= 30 days).
 */
export function computeVehicleAlerts(vehicles: any[], maxThresholdDays = 30): VehicleAlert[] {
  if (!Array.isArray(vehicles) || vehicles.length === 0) return [];

  const alerts: VehicleAlert[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  vehicles.forEach((v: any) => {
    if (!v) return;
    const vId = v.id || v.vehicleId || '';
    const vNum = v.vehicleNumber || v.vehicleNo || vId || 'Unknown';

    COMPLIANCE_VALIDITY_FIELDS.forEach((f) => {
      const val = v[f.key];
      if (val && typeof val === 'string' && val.trim() && val !== '-') {
        const dateObj = new Date(val);
        if (!isNaN(dateObj.getTime())) {
          const expDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
          const diffTime = expDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Alert if expired (< 0) or expiring within threshold (<= 30 days)
          if (diffDays <= maxThresholdDays) {
            const isExpired = diffDays < 0;
            const status: 'expired' | 'critical' | 'warning' = isExpired
              ? 'expired'
              : diffDays <= 3
              ? 'critical'
              : 'warning';

            alerts.push({
              vehicleId: vId,
              vehicleNumber: vNum,
              ownerName: v.ownerName || '',
              documentKey: f.key,
              documentLabel: f.label,
              expiryDate: val,
              daysRemaining: diffDays,
              isExpired,
              status,
              vehicle: v,
            });
          }
        }
      }
    });
  });

  // Sort alerts: most urgent (lowest daysRemaining / expired) first
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
