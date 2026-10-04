import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/server/appsScriptClient';
import { getSessionToken } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionToken = getSessionToken();
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, data: null, message: 'Unauthorized session' },
        { status: 401 }
      );
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, data: null, message: 'Document ID is required' },
        { status: 400 }
      );
    }

    const result = await callAppsScript<any>('documents.content', { documentId: id }, sessionToken);

    if (!result.success || !result.data || !result.data.base64Data) {
      return NextResponse.json(
        { success: false, data: null, message: result.message || 'File content not found' },
        { status: 404 }
      );
    }

    const fileData = result.data;
    const buffer = Buffer.from(fileData.base64Data, 'base64');
    const mimeType = fileData.mimeType || 'application/pdf';
    const fileName = fileData.fileName || `document-${id}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, data: null, message: error.message || 'Failed to download document' },
      { status: 500 }
    );
  }
}
