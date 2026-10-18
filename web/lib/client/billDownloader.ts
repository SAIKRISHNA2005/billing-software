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

    // Parse the full HTML document to extract <style> rules and body markup
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract all CSS style contents
    const styles = Array.from(doc.querySelectorAll('style'));
    const styleText = styles.map((s) => s.textContent).join('\n');

    // Extract invoice wrapper content or body
    const invoiceWrapper = doc.querySelector('.invoice-wrapper') || doc.body;

    // Create an invisible render container at (0, 0) behind application content
    // Setting left: 0, top: 0, opacity: 1 ensures html2canvas captures pixels from (0, 0)
    // Setting zIndex: -99999 and pointerEvents: none keeps it completely hidden from the user
    const container = document.createElement('div');
    container.id = 'bill-pdf-render-root';
    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.minHeight = '297mm';
    container.style.backgroundColor = '#ffffff';
    container.style.zIndex = '-99999';
    container.style.opacity = '1';
    container.style.pointerEvents = 'none';

    // Inject styles directly into the container
    if (styleText) {
      const styleEl = document.createElement('style');
      styleEl.textContent = styleText;
      container.appendChild(styleEl);
    }

    // Append the cloned invoice markup
    container.appendChild(invoiceWrapper.cloneNode(true));
    document.body.appendChild(container);

    try {
      // Allow browser to calculate layout and apply CSS rules
      await new Promise((resolve) => setTimeout(resolve, 150));

      const opt = {
        margin: [0, 0, 0, 0],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
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
