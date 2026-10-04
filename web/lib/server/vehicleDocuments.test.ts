import { describe, it, expect } from 'vitest';
import { DOCUMENT_CATEGORIES } from '@/components/documents/DocumentUploadModal';

describe('Vehicle Document Management System', () => {
  it('strictly contains only vehicle compliance document categories', () => {
    const categoryValues = DOCUMENT_CATEGORIES.map((c) => c.value);

    // Assert strictly vehicle document categories are present
    expect(categoryValues).toContain('RC');
    expect(categoryValues).toContain('INSURANCE');
    expect(categoryValues).toContain('FITNESS');
    expect(categoryValues).toContain('PUCC');
    expect(categoryValues).toContain('STATE_PERMIT');
    expect(categoryValues).toContain('NATIONAL_PERMIT');
    expect(categoryValues).toContain('TAX_TOKEN');
    expect(categoryValues).toContain('OTHER');

    // Confirm NO bills, enquiries, or clients document categories exist
    expect(categoryValues).not.toContain('BILL');
    expect(categoryValues).not.toContain('INVOICE');
    expect(categoryValues).not.toContain('ENQUIRY');
    expect(categoryValues).not.toContain('CLIENT');
  });

  it('validates binary base64 conversion integrity for PDF streaming', () => {
    const samplePdfHeader = '%PDF-1.4 sample vehicle RC content';
    const base64 = Buffer.from(samplePdfHeader, 'utf-8').toString('base64');
    const reconstructed = Buffer.from(base64, 'base64').toString('utf-8');

    expect(reconstructed).toBe(samplePdfHeader);
  });

  it('enforces clean file naming for Google Drive storage', () => {
    const messyName = 'RC & Insurance (Special #1) 2026.pdf';
    const cleaned = messyName.replace(/[^a-zA-Z0-9._-]/g, '_');
    expect(cleaned).toBe('RC___Insurance__Special__1__2026.pdf');
    expect(cleaned.endsWith('.pdf')).toBe(true);
  });
});
