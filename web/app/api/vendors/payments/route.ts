import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

const CreateVendorPaymentSchema = z.object({
  vendorId: z.string().min(1, 'Vendor is required'),
  enquiryId: z.string().optional(),
  paymentDate: z.string().min(1, 'Payment date is required'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  mode: z.enum(['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Other']),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const params = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      search: searchParams.get('search') || '',
      vendorId: searchParams.get('vendorId') || undefined,
      enquiryId: searchParams.get('enquiryId') || undefined,
      mode: searchParams.get('mode') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      sortField: searchParams.get('sortField') || 'paymentDate',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    const result = await callAppsScript('vendorPayment.list', params, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve vendor payments';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}

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
    const parseResult = CreateVendorPaymentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          message: parseResult.error.errors[0]?.message || 'Invalid input data',
          errors: parseResult.error.errors,
        },
        { status: 400 }
      );
    }

    const result = await callAppsScript('vendorPayment.create', parseResult.data, sessionToken);
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create vendor payment';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
