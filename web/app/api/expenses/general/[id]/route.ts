import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

interface RouteContext {
  params: {
    id: string;
  };
}

const UpdateGeneralExpenseSchema = z.object({
  expenseDate: z.string().optional(),
  category: z
    .enum([
      'Office Stationery',
      'Internet',
      'Electricity',
      'Tea/Coffee',
      'Maintenance',
      'Salary-Related',
      'Office Repairs',
      'Other',
    ])
    .optional(),
  amount: z.number().positive('Amount must be greater than 0').optional(),
  description: z.string().optional(),
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

    const result = await callAppsScript('generalExpense.get', { id: params.id }, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve general expense';
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
    const parseResult = UpdateGeneralExpenseSchema.safeParse(body);
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
      'generalExpense.update',
      { id: params.id, patch: parseResult.data },
      sessionToken
    );
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update general expense';
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

    const result = await callAppsScript('generalExpense.delete', { id: params.id }, sessionToken);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete general expense';
    return NextResponse.json({ success: false, data: null, message }, { status: 500 });
  }
}
