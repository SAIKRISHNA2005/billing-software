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
  loadingType: z.enum(['Import', 'Export', 'Empty', 'Offload', 'Flattrack'], {
    required_error: 'Loading Type must be selected',
  }),
  date: z.string().optional(),

  // Section 1 - Basic Details extras
  containerSize: z.string().optional(),
  noOfContainers: z.coerce.number().min(1).max(15).default(1),

  // Section 2 - Client & Booking extras
  bookingNumber: z.string().optional(),
  bookingDate: z.string().optional(),
  weight: z.string().optional(),
  clientAddress: z.string().optional(),
  clientAdd1: z.string().optional(),
  clientAdd2: z.string().optional(),
  clientAdd3: z.string().optional(),
  clientPan: z.string().optional(),
  clientGstin: z.string().optional(),
  comments: z.string().optional(),

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

  // Additional container items for multiple containers
  containers: z
    .array(
      z.object({
        containerNumber: z.string().optional(),
        sealNumber: z.string().optional(),
        vehicleNumber: z.string().optional(),
        driverName: z.string().optional(),
        driverPhone: z.string().optional(),
      })
    )
    .optional(),

  // Vendor
  vendorId: z.string().optional(),
  vendorDriverName: z.string().optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  paymentType: z.string().optional(),
  paymentDate: z.string().optional(),

  // Movement gate times & statuses
  companyInTime: z.string().optional(),
  companyOutTime: z.string().optional(),
  printInTime: z.string().optional(),
  printOutTime: z.string().optional(),
  portInTime: z.string().optional(),
  portOutTime: z.string().optional(),
  movementStatus: z.string().optional(),
  shippingStatus: z.string().optional(),

  // Charges & Payments
  freightAmount: z.coerce.number().min(0, 'Freight amount cannot be negative').default(0),
  dieselAmount: z.coerce.number().min(0, 'Diesel amount cannot be negative').default(0),
  advanceAmount: z.coerce.number().min(0, 'Advance amount cannot be negative').default(0),
  extraAdvance: z.coerce.number().min(0, 'Extra advance cannot be negative').default(0),
  haltingDays: z.coerce.number().int().min(0, 'Halting days cannot be negative').default(0),
  haltingAmount: z.coerce.number().min(0, 'Halting amount cannot be negative').default(0),
  otherCharges: z.coerce.number().min(0, 'Other charges cannot be negative').default(0),
  billAmount: z.coerce.number().min(0, 'Bill amount cannot be negative').optional(),
  paidStatus: z.string().optional(),
  amountReceived: z.coerce.number().min(0, 'Amount received cannot be negative').optional(),
  amountReceivedDate: z.string().optional(),
  bonus: z.coerce.number().min(0, 'Bonus cannot be negative').default(0),

  // Route & Documents
  shipmentDate: z.string().optional(),
  containerFrom: z.string().optional(),
  containerTo: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  truckCount20: z.coerce.number().min(0).optional(),
  truckCount40: z.coerce.number().min(0).optional(),
});

export type EnquiryFormData = z.infer<typeof enquiryFormSchema>;
