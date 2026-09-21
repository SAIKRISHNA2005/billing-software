import { z } from 'zod';
import { isValidVehicleNumber, isValidDriverPhone } from './masterValidation';

export const CONTAINER_NUMBER_REGEX = /^[A-Z]{4}[0-9]{7}$/;

export const STAGE_TAG_COLORS: Record<string, string> = {
  ENQUIRY_CREATED: 'default',
  VEHICLE_ASSIGNED: 'processing',
  CONTAINER_MOVEMENT: 'cyan',
  PORT_MOVEMENT: 'purple',
  COMPLETED: 'success',
  BILLING: 'gold',
  PROCESSED: 'green',
};

export const STAGE_LABELS: Record<string, string> = {
  ENQUIRY_CREATED: 'Created',
  VEHICLE_ASSIGNED: 'Vehicle Assigned',
  CONTAINER_MOVEMENT: 'Container Movement',
  PORT_MOVEMENT: 'Port Movement',
  COMPLETED: 'Completed',
  BILLING: 'Billing',
  PROCESSED: 'Processed',
};

/**
 * Normalizes container number: trims, strips hyphens/spaces, and converts to uppercase.
 */
export function normalizeContainerNumber(val?: string | null): string {
  if (!val) return '';
  return val.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Validates container number format (D12: 4 uppercase letters + 7 digits).
 */
export function isValidContainerNumber(val?: string | null): boolean {
  if (!val) return false;
  return CONTAINER_NUMBER_REGEX.test(normalizeContainerNumber(val));
}

/**
 * Schema for creating a new transport enquiry.
 */
export const enquiryFormSchema = z.object({
  companyId: z.string().min(1, 'Company is required'),
  clientId: z.string().min(1, 'Client is required'),
  loadingType: z.enum(['Import', 'Export'], {
    required_error: 'Loading Type must be either Import or Export',
  }),
  date: z.string().optional(),

  // Vehicle / Driver / Container
  vehicleNumber: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || !val.trim()) return true;
        return isValidVehicleNumber(val);
      },
      {
        message: 'Invalid vehicle number format (e.g. TN04AB1234)',
      }
    ),
  driverName: z.string().optional(),
  driverPhone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || !val.trim()) return true;
        return isValidDriverPhone(val);
      },
      {
        message: 'Driver mobile must be 10 digits starting with 6, 7, 8, or 9',
      }
    ),
  containerNumber: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || !val.trim()) return true;
        return isValidContainerNumber(val);
      },
      {
        message: 'Container number must be 4 uppercase letters followed by 7 digits (e.g. MSCU1234567)',
      }
    ),
  containerType: z.string().optional(),
  sealNumber: z.string().optional(),

  // Vendor
  vendorId: z.string().optional(),

  // Movement gate times
  companyInTime: z.string().optional(),
  companyOutTime: z.string().optional(),
  printInTime: z.string().optional(),
  printOutTime: z.string().optional(),
  portInTime: z.string().optional(),
  portOutTime: z.string().optional(),

  // Money fields - non-negative
  freightAmount: z.coerce.number().min(0, 'Freight amount cannot be negative').default(0),
  dieselAmount: z.coerce.number().min(0, 'Diesel amount cannot be negative').default(0),
  advanceAmount: z.coerce.number().min(0, 'Advance amount cannot be negative').default(0),
  extraAdvance: z.coerce.number().min(0, 'Extra advance cannot be negative').default(0),
  haltingDays: z.coerce.number().int().min(0, 'Halting days cannot be negative').default(0),
  haltingAmount: z.coerce.number().min(0, 'Halting amount cannot be negative').default(0),
  bonus: z.coerce.number().min(0, 'Bonus cannot be negative').default(0),
});

export type EnquiryFormData = z.infer<typeof enquiryFormSchema>;
