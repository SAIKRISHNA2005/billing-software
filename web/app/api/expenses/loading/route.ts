import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

const CreateLoadingExpenseSchema = z.object({
  expenseDate: z.string().min(1, 'Expense date is required'),
  category: z.enum([
    'Diesel',
    'Loading Charges',
    'Unloading Charges',
    'Parking',
    'Halting',
    'Other Trip Expenses',
  ]),
  amount: z.number().positive('Amount must be greater than 0'),
  description: z.string().optional(),
  enquiryId: z.string().optional(),
  vehicleId: z.string().optional(),
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
      category: searchParams.get('category') || undefined,
      enquiryId: searchParams.get('enquiryId') || undefined,
      vehicleId: searchParams.get('vehicleId') || undefined,
      companyId: searchParams.get('companyId') || undefined,
      clientId: searchParams.get('clientId') || undefined,
      source: searchParams.get('source') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      sortField: searchParams.get('sortField') || 'expenseDate',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    const result = await callAppsScript('loadingExpense.list', params, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve loading expenses';
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
    const parseResult = CreateLoadingExpenseSchema.safeParse(body);
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

    const result = await callAppsScript('loadingExpense.create', parseResult.data, sessionToken);
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create loading expense';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
