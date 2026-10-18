/**
 * Utility for downloading bill PDF directly without print dialogs.
 *
 * Strategy:
 * 1. If base64-encoded PDF is provided (generated server-side via Chrome/Puppeteer),
 *    instantly converts it to a binary Blob and triggers direct browser download.
 * 2. If server-side Chrome is unavailable (e.g., Vercel, serverless, or containerized deployments
 *    where Chrome executable is not installed), client-side html2pdf.js renders the
 *    pristine A4 bill HTML into an A4 PDF and triggers direct browser download.
 * 3. Never opens a print dialog. Directly downloads as `Invoice_<invoiceNumber>.pdf`.
 */

export interface DownloadBillPdfOptions {
  pdfBase64?: string | null;
  html?: string | null;
  filename: string;
}

export async function downloadBillPdf({
  pdfBase64,
  html,
  filename,
}: DownloadBillPdfOptions): Promise<void> {
  // Strategy 1: Fast Base64 Blob download
  if (pdfBase64 && pdfBase64.trim()) {
    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    triggerBlobDownload(blob, filename);
    return;
  }

  // Strategy 2: Client-side rendering via html2pdf.js
  if (html && html.trim()) {
    // Dynamic import to prevent SSR evaluation
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = (html2pdfModule.default || html2pdfModule) as any;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-99999px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.background = '#ffffff';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const opt = {
        margin: [0, 0, 0, 0],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
      };

      await html2pdf().set(opt).from(container).save();
    } finally {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }
    return;
  }

  throw new Error('No PDF data or HTML template available for download');
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}
