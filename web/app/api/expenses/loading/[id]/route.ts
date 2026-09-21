import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

interface RouteContext {
  params: {
    id: string;
  };
}

const UpdateLoadingExpenseSchema = z.object({
  expenseDate: z.string().optional(),
  category: z
    .enum([
      'Diesel',
      'Loading Charges',
      'Unloading Charges',
      'Parking',
      'Halting',
      'Other Trip Expenses',
    ])
    .optional(),
  amount: z.number().positive('Amount must be greater than 0').optional(),
  description: z.string().optional(),
  enquiryId: z.string().optional(),
  vehicleId: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized: No active session' },
        { status: 401 }
      );
    }

    const result = await callAppsScript('loadingExpense.get', { id: params.id }, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve loading expense';
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

    const body = await req.json();
    const parseResult = UpdateLoadingExpenseSchema.safeParse(body);
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

    const result = await callAppsScript(
      'loadingExpense.update',
      { id: params.id, patch: parseResult.data },
      sessionToken
    );
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update loading expense';
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

    const result = await callAppsScript('loadingExpense.delete', { id: params.id }, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete loading expense';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
