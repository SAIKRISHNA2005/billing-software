/**
 * Utility for downloading bill PDF directly without print dialogs.
 *
 * Strategy:
 * 1. If base64-encoded PDF is provided (generated server-side via Chrome/Puppeteer),
 *    instantly converts it to a binary Blob and triggers direct browser download.
 * 2. If server-side Chrome is unavailable (e.g., Vercel, serverless, or cloud Linux
 *    deployments without Chrome binary), directly renders the A4 bill template using
 *    an isolated iframe with html2canvas + jsPDF in-browser. This avoids the blank-page bug
 *    in html2pdf.js and produces a crisp, complete A4 PDF matching the exact template.
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
  // Strategy 1: Fast Base64 Blob download (when server-side Chrome is available)
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

  // Strategy 2: Direct in-browser rendering via isolated iframe + html2canvas + jsPDF
  if (html && html.trim()) {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    // Create an invisible iframe container in the DOM so that the complete HTML document
    // (with its full <head>, <style>, table borders, and <body>) is rendered with proper isolation
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '0';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-99999';
    iframe.style.opacity = '1';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Unable to access render frame for PDF generation');
      }

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Allow fonts and layouts to settle
      await new Promise((resolve) => setTimeout(resolve, 300));

      const wrapper = (iframeDoc.querySelector('.invoice-wrapper') || iframeDoc.body) as HTMLElement;

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
      });

      const pdf = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      });

      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgDataUrl = canvas.toDataURL('image/jpeg', 0.98);

      pdf.addImage(imgDataUrl, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, 297));
      pdf.save(filename);
    } finally {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
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
